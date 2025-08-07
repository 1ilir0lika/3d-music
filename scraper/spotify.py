import requests
import json
import time

# ------------------ CONFIG ------------------

SPOTIFY_PLAYLIST_ID = "1zmwMVDleZsK8qc7PJ1Xe5"  # <- Replace with your playlist ID
SPOTIFY_CLIENT_ID = "e2ad3b8b7ca14593b979dab5bc907a67"
SPOTIFY_CLIENT_SECRET = "0b6288b6cc2d437ab99819f662140743"
X_WP_NONCE = "d38f6cfdd8"  # May need to update periodically
MAX_TRACKS = 10000000  # Optional limit

# ------------------ AUTH ------------------

def get_spotify_token(client_id, client_secret):
    token_url = "https://accounts.spotify.com/api/token"
    resp = requests.post(token_url, data={
        'grant_type': 'client_credentials'
    }, auth=(client_id, client_secret))
    return resp.json()["access_token"]

# ------------------ FETCH SPOTIFY TRACKS ------------------

def get_playlist_tracks(playlist_id, token, max_tracks=MAX_TRACKS):
    headers = {'Authorization': f'Bearer {token}'}
    tracks = []
    offset = 0

    while len(tracks) < max_tracks:
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
                if len(tracks) >= max_tracks:
                    break
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
    tracks = get_playlist_tracks(SPOTIFY_PLAYLIST_ID, token, MAX_TRACKS)

    all_data = []

    for i, track in enumerate(tracks):
        print(f"[{i+1}/{len(tracks)}] Fetching {track['name']} by {track['artist']}...")
        data = fetch_chosic_data(track["id"], X_WP_NONCE)
        if data:
            data["spotify"] = track
            all_data.append(data)
        time.sleep(0.1)  # Be kind to Chosic's server

    with open("playlist_chosic_data.json", "w") as f:
        json.dump(all_data, f, indent=4)

    print("✅ Done. Data saved to 'playlist_chosic_data.json'")

if __name__ == "__main__":
    main()

