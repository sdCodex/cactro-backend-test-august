Spotify API Express Server
This project is a simple Node.js Express server that demonstrates how to authenticate with the Spotify Web API and access a user's data, such as top tracks and followed artists. It also includes endpoints to control playback on a user's active device.

Features
OAuth 2.0 Authentication: Securely log in with your Spotify account.

Token Refresh: Automatically refreshes the access token when it's about to expire.

Top Tracks: Fetches a list of the user's top 10 tracks.

Playback Control:

Play a specific track using its URI.

Play a random song from the user's top tracks.

Pause the current playback.

Currently Playing: Get information about the song currently being played.

Followed Artists: Retrieve a list of the artists the user follows.

Prerequisites
Before running the server, ensure you have the following installed:

Node.js & npm

A Spotify Developer Account and a registered application to get your Client ID and Client Secret.

A .env file in the root directory of the project with the following environment variables:

SPOTIFY_CLIENT_ID=YOUR_CLIENT_ID
SPOTIFY_CLIENT_SECRET=YOUR_CLIENT_SECRET
SPOTIFY_REDIRECT_URI=http://localhost:8888/spotify/callback

Note: The Redirect URI in your .env file must exactly match the one you configured in your Spotify Developer Dashboard.

Installation
Clone the repository or save the index.js file.

Install the required npm packages:

npm install express axios dotenv

Usage
Start the server from your terminal:

node index.js

Open your web browser and navigate to http://localhost:8888.

Click the "Login with Spotify" link to begin the authentication process. You will be redirected to Spotify's login page.

After successfully authorizing the application, you will be redirected back to the /spotify/dashboard page, which provides a list of the available endpoints.

API Endpoints
Once authenticated, you can make requests to these endpoints using tools like curl or Postman.

GET /spotify/top-tracks

Returns a JSON object containing the user's top tracks.

Example Response: {"topTracks":[{"id":"...","name":"...","artist":"...","album":"...","uri":"...","externalUrl":"..."}]}

GET /spotify/now-playing

Returns a JSON object with details of the currently playing song or a message if nothing is playing.

Example Response: {"nowPlaying":{"id":"...","name":"...","artist":"...","album":"...","uri":"...","isPlaying":true,"albumArt":"..."}}

GET /spotify/followed-artists

Returns a JSON object with a list of the user's followed artists.

Example Response: {"followedArtists":[{"name":"...","externalUrl":"..."}]}

POST /spotify/play-random-top-track

Plays a random song from your top tracks.

This endpoint does not require a request body.

POST /spotify/play

Plays a specific track from a given URI. Requires a Spotify Premium account.

Request Body (JSON):

{
  "trackUri": "spotify:track:YOUR_TRACK_ID_HERE"
}

POST /spotify/stop

Pauses the currently playing track. Requires a Spotify Premium account.

This endpoint does not require a request body.