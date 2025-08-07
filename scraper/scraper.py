import re
import requests
import json

# --------- 1. Input HTML with embedded Spotify track ---------
html = '''
<iframe data-testid="embed-iframe" style="border-radius:12px" src="https://open.spotify.com/embed/track/4gT1faTjrtFRFTsr2bqqYV?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
'''

# --------- 2. Extract Spotify Track ID ---------
match = re.search(r'spotify\.com/embed/track/([a-zA-Z0-9]+)', html)
if not match:
    raise ValueError("Spotify track ID not found.")

track_id = match.group(1)
print("Track ID:", track_id)

# --------- 3. Prepare Headers for Chosic API ---------
headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'X-WP-Nonce': 'd38f6cfdd8',  # Refresh if expired
    'app': 'genre_finder',
    'X-Requested-With': 'XMLHttpRequest',
    'Sec-GPC': '1',
    'Referer': f'https://www.chosic.com/music-genre-finder/?track={track_id}',
    'Cookie': 'pll_language=en',
    'Connection': 'keep-alive'
}

# --------- 4. Fetch Audio Features ---------
audio_features_url = f'https://www.chosic.com/api/tools/audio-features/{track_id}'
audio_response = requests.get(audio_features_url, headers=headers)
if audio_response.status_code != 200:
    raise RuntimeError(f"Audio features request failed: {audio_response.status_code}")
audio_data = audio_response.json()

# --------- 5. Fetch Track Info ---------
track_info_url = f'https://www.chosic.com/api/tools/tracks/{track_id}'
track_response = requests.get(track_info_url, headers=headers)
if track_response.status_code != 200:
    raise RuntimeError(f"Track info request failed: {track_response.status_code}")
track_data = track_response.json()

# --------- 6. Merge and Save ---------
combined_data = {
    "track_id": track_id,
    "track_info": track_data,
    "audio_features": audio_data
}

with open("track_metadata.json", "w") as f:
    json.dump(combined_data, f, indent=4)

print("Saved track metadata to 'track_metadata.json'")

