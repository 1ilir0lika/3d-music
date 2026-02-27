import requests
import json
import time
import os

# ------------------ CONFIG ------------------
SPOTIFY_PLAYLIST_ID = "0ta9XHC4LIO1n9Zv4wCurm"  # <- Replace with your playlist ID
SPOTIFY_CLIENT_ID = "e2ad3b8b7ca14593b979dab5bc907a67"
SPOTIFY_CLIENT_SECRET = "0b6288b6cc2d437ab99819f662140743"
X_WP_NONCE = "d38f6cfdd8"  # May need to update periodically
OUTPUT_FILE = "playlist_chosic_data.json"

# ------------------ AUTH ------------------

def get_spotify_token(client_id, client_secret):
    token_url = "https://accounts.spotify.com/api/token"
    resp = requests.post(token_url, data={
        'grant_type': 'client_credentials'
    }, auth=(client_id, client_secret))
    return resp.json()["access_token"]

# ------------------ FETCH SPOTIFY TRACKS ------------------

def get_playlist_tracks(playlist_id, token):
    headers = {'Authorization': f'Bearer {token}'}
    tracks = []
    offset = 0

    while True:
        url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks?offset={offset}&limit=100"
        resp = requests.get(url, headers=headers)
        data = resp.json()
        for item in data.get("items", []):
            track = item.get("track")
            if track and track.get("id"):
                tracks.append({
                    "id": track["id"],
                    "name": track["name"],
                    "artist": track["artists"][0]["name"]
                })
        if not data.get("next"):
            break
        offset += 100

    return tracks

# ------------------ FETCH CHOSIC METADATA ------------------

def fetch_chosic_data(track_id, nonce):
    headers = {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        'X-WP-Nonce': nonce,
        'app': 'genre_finder',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': f'https://www.chosic.com/music-genre-finder/?track={track_id}',
        'Cookie': 'pll_language=en'
    }

    result = {}

    track_url = f'https://www.chosic.com/api/tools/tracks/{track_id}'
    features_url = f'https://www.chosic.com/api/tools/audio-features/{track_id}'

    try:
        r1 = requests.get(track_url, headers=headers)
        r2 = requests.get(features_url, headers=headers)
        if r1.status_code == 200:
            result["track_info"] = r1.json()
        if r2.status_code == 200:
            result["audio_features"] = r2.json()
    except Exception as e:
        print(f"Error fetching for {track_id}: {e}")

    return result

# ------------------ MAIN ------------------

def main():
    token = get_spotify_token(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)
    tracks = get_playlist_tracks(SPOTIFY_PLAYLIST_ID, token)

    # Load existing JSON if available
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r") as f:
            try:
                all_data = json.load(f)
            except json.JSONDecodeError:
                all_data = []
    else:
        all_data = []

    existing_ids = {entry["spotify"]["id"] for entry in all_data if "spotify" in entry}

    for i, track in enumerate(tracks):
        if track["id"] in existing_ids:
            print(f"[{i+1}/{len(tracks)}] Skipping {track['name']} (already exists)")
            continue

        print(f"[{i+1}/{len(tracks)}] Fetching {track['name']} by {track['artist']}...")
        data = fetch_chosic_data(track["id"], X_WP_NONCE)
        if data:
            data["spotify"] = track
            all_data.append(data)
        time.sleep(0.1)  # Be kind to Chosic's server

    with open(OUTPUT_FILE, "w") as f:
        json.dump(all_data, f, indent=4)

    print(f"✅ Done. Data saved/updated in '{OUTPUT_FILE}'")

if __name__ == "__main__":
    main()
