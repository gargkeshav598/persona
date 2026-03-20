import re


# ----------------------
# CLEAN (safe + minimal)
# ----------------------
def clean(value):
    if value is None:
        return None

    if isinstance(value, str):
        v = re.sub(r"<[^>]*>", "", value)
        v = re.sub(r"\s+", " ", v).strip()
        return v if v else None

    if isinstance(value, list):
        arr = [clean(v) for v in value]
        arr = [v for v in arr if v is not None]
        return arr if arr else None

    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            cleaned = clean(v)
            if cleaned is not None:
                out[k] = cleaned
        return out if out else None

    return value


# ----------------------
# REMOVE NONE (final pass)
# ----------------------
def remove_none(data):
    if isinstance(data, dict):
        return {k: remove_none(v) for k, v in data.items() if v is not None}
    if isinstance(data, list):
        return [remove_none(v) for v in data if v is not None]
    return data


# ----------------------
# NORMALIZE LINKEDIN
# ----------------------
def normalize_linkedin(profile):
    if not isinstance(profile, dict):
        return {}

    return {
        "name": profile.get("name"),
        "firstName": profile.get("first_name"),
        "lastName": profile.get("last_name"),
        "location": profile.get("location") or profile.get("city"),

        "company": (
            (profile.get("current_company") or {}).get("name")
            or profile.get("current_company_name")
        ),

        "education": [
            {
                "school": e.get("title"),
                "start": e.get("start_year"),
                "end": e.get("end_year"),
            }
            for e in (profile.get("education") or [])
            if isinstance(e, dict)
        ] or None,

        "highlights": [
            {
                "title": a.get("title"),
                "year": (a.get("date") or "")[:4] if a.get("date") else None,
                "description": a.get("description"),
            }
            for a in (profile.get("honors_and_awards") or [])
            if isinstance(a, dict)
        ] or None,

        "stats": {
            "followers": profile.get("followers"),
            "connections": profile.get("connections"),
        },
    }


# ----------------------
# NORMALIZE POSTS
# ----------------------
def normalize_posts(posts):
    normalized = []

    for p in posts:
        if not isinstance(p, dict):
            continue

        text = p.get("description")

        post = {
            "text": text,
            "date": p.get("date_posted"),

            "engagement": {
                "likes": p.get("likes", 0),
                "replies": p.get("replies", 0),
                "reposts": p.get("reposts", 0),
                "views": p.get("views", 0),
            },

            "isReply": (text or "").startswith("@"),
        }

        if isinstance(p.get("quoted_post"), dict):
            post["quoted"] = {
                "text": p["quoted_post"].get("description"),
                "author": p["quoted_post"].get("profile_name"),
            }

        normalized.append(post)

    return normalized


# ----------------------
# FILTER SIGNAL
# ----------------------
def is_high_signal(post):
    text = post.get("text") or ""

    if not text:
        return False

    if post.get("isReply") and len(text) < 50:
        return False

    if len(text) < 30:
        return False

    e = post.get("engagement", {})
    score = (
        e.get("likes", 0)
        + e.get("reposts", 0) * 2
        + e.get("replies", 0)
    )

    return score > 50 or len(text) > 80


# ----------------------
# RANK POSTS
# ----------------------
def rank_posts(posts):
    def score(p):
        e = p.get("engagement", {})
        return (
            e.get("likes", 0)
            + e.get("reposts", 0) * 2
            + e.get("replies", 0)
        )

    return sorted(posts, key=score, reverse=True)


# ----------------------
# MAIN PIPELINE FUNCTION
# ----------------------
def build_llm_input(linkedin_raw, x_raw):
    # --- LinkedIn safe handling ---
    if isinstance(linkedin_raw, list) and len(linkedin_raw) > 0:
        cleaned_linkedin = clean(linkedin_raw[0])
    else:
        cleaned_linkedin = {}

    # --- Twitter safe handling ---
    cleaned_x = clean(x_raw)
    if not isinstance(cleaned_x, list):
        cleaned_x = []

    profile = normalize_linkedin(cleaned_linkedin)

    posts = normalize_posts(cleaned_x)

    filtered_posts = [p for p in posts if is_high_signal(p)]
    ranked_posts = rank_posts(filtered_posts)[:5]

    # fallback if everything filtered out
    if not ranked_posts and posts:
        ranked_posts = posts[:2]

    return remove_none({
        "profile": profile,
        "posts": ranked_posts,
    })