const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;


app.use(express.json());

// Spotify API credentials 
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Spotify API scopes required for the requested functionality
const scopes = [
    'user-top-read',
    'user-read-currently-playing',
    'user-follow-read',
    'user-modify-playback-state'
];

// In-memory storage for tokens. NOTE: This is NOT secure for production.

let accessToken = null;
let refreshToken = null;
let tokenExpiryTime = 0; 

// --- Helper Functions ---

async function ensureAccessTokenValid() {
    if (!accessToken) {
        console.log('No access token available. User needs to log in.');
        return false;
    }

    const currentTime = Date.now();
    const fiveMinutesInMs = 5 * 60 * 1000;
    if (currentTime >= tokenExpiryTime - fiveMinutesInMs) {
        console.log('Access token expired or close to expiring. Attempting to refresh...');
        return await refreshAccessToken();
    }
    return true;
}


async function refreshAccessToken() {
    if (!refreshToken) {
        console.error('No refresh token available to refresh access token.');
        return false;
    }

    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            }).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        accessToken = response.data.access_token;
        const expiresIn = response.data.expires_in;
        tokenExpiryTime = Date.now() + (expiresIn * 1000);
        console.log('Access token refreshed successfully!');
        return true;
    } catch (error) {
        console.error('Error refreshing access token:', error.response ? error.response.data : error.message);
        accessToken = null;
        refreshToken = null;
        return false;
    }
}

/**
 * A wrapper function for making authenticated requests to the Spotify API.
 
 */
async function spotifyApiRequest(url, method = 'get', data = null) {
    if (!await ensureAccessTokenValid()) {
        return { error: 'Authentication required. Please visit /spotify/login first.' };
    }

    try {
        const config = {
            method: method,
            url: url,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };
        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`Error during Spotify API request to ${url}:`, error.response ? error.response.data : error.message);
        if (error.response && error.response.status === 401) {
            accessToken = null;
            refreshToken = null;
            return { error: 'Access token invalid or expired. Please re-authenticate via /spotify/login.' };
        }
        return { error: 'Failed to fetch data from Spotify API.', details: error.response ? error.response.data : error.message };
    }
}

// Spotify Authentication Endpoints

// Home route
app.get('/spotify', (req, res) => {
    res.send('<h1>Spotify API Integration</h1><p>Please log in to Spotify to authorize the application.</p><a href="/spotify/login">Login with Spotify</a>');
});

// Spotify login
app.get('/spotify/login', (req, res) => {
    const authorizeUrl = 'https://accounts.spotify.com/authorize?' +
        new URLSearchParams({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scopes.join(' '),
            redirect_uri: REDIRECT_URI,
        }).toString();
    res.redirect(authorizeUrl);
});


// Callback route
app.get('/spotify/callback', async (req, res) => {
    const code = req.query.code || null;
    const error = req.query.error || null;

    if (error) {
        console.error('Spotify callback error:', error);
        return res.status(400).json({ error: 'Spotify authorization failed.', details: error });
    }

    if (!code) {
        return res.status(400).json({ error: 'No authorization code received.' });
    }

    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            }).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token;
        const expiresIn = response.data.expires_in;
        tokenExpiryTime = Date.now() + (expiresIn * 1000);

        console.log('Successfully obtained Spotify tokens.');
        res.redirect('/spotify/dashboard'); // Redirect to a success page

    } catch (error) {
        console.error('Error exchanging authorization code for tokens:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to authenticate with Spotify.', details: error.response ? error.response.data : error.message });
    }
});

// Spotify API Data Endpoints 

// Dashboard
app.get('/spotify/dashboard', (req, res) => {
    res.send(`
        <h1>Spotify API Dashboard</h1>
        <p>Authentication successful! You can now use the following endpoints:</p>
        <ul>
            <li><a href="/spotify/top-tracks">/spotify/top-tracks</a></li>
            <li><a href="/spotify/now-playing">/spotify/now-playing</a></li>
            <li><a href="/spotify/followed-artists">/spotify/followed-artists</a></li>
            <li>POST /spotify/play-random-top-track - plays a random track from the top 10 list</li>
            <li>POST /spotify/stop</li>
        </ul>
    `);
});

// Endpoint to get user's top 10 tracks
app.get('/spotify/top-tracks', async (req, res) => {
    const data = await spotifyApiRequest('https://api.spotify.com/v1/me/top/tracks?limit=10');
    if (data && data.items) {
        const topTracks = data.items.map(track => ({
            id: track.id,
            name: track.name,
            artist: track.artists.map(artist => artist.name).join(', '),
            album: track.album.name,
            uri: track.uri,
            externalUrl: track.external_urls.spotify,
        }));
        res.json({ topTracks: topTracks });
    } else {
        res.status(data.error ? 401 : 500).json(data);
    }
});

// Endpoint to get the currently playing song
app.get('/spotify/now-playing', async (req, res) => {
    const data = await spotifyApiRequest('https://api.spotify.com/v1/me/player/currently-playing');
    if (data && data.item) {
        const nowPlaying = {
            id: data.item.id,
            name: data.item.name,
            artist: data.item.artists.map(artist => artist.name).join(', '),
            album: data.item.album.name,
            uri: data.item.uri,
            isPlaying: data.is_playing,
            albumArt: data.item.album.images[0].url,
        };
        res.json({ nowPlaying: nowPlaying });
    } else if (data && data.error) {
        res.status(401).json(data);
    } else {
        res.json({ nowPlaying: null, message: 'No song currently playing or no active device.' });
    }
});


// Endpoint to get user's followed artists
app.get('/spotify/followed-artists', async (req, res) => {
    const data = await spotifyApiRequest('https://api.spotify.com/v1/me/following?type=artist');
    if (data && data.artists && data.artists.items) {
        const followedArtists = data.artists.items.map(artist => ({
            name: artist.name,
            externalUrl: artist.external_urls.spotify,
        }));
        res.json({ followedArtists: followedArtists });
    } else {
        res.status(data.error ? 401 : 500).json(data);
    }
});


// Endpoint to stop the currently playing song (requires Spotify Premium)
app.post('/spotify/stop', async (req, res) => {
    const data = await spotifyApiRequest('https://api.spotify.com/v1/me/player/pause', 'put');
    if (data && data.error) {
        res.status(400).json(data);
    } else {
        res.json({ message: 'Attempted to stop playback. Check /spotify/now-playing for status.' });
    }
});





 //Endpoint to play a random track from the top 10 list.
 
app.post('/spotify/play-random-top-track', async (req, res) => {
    
    const topTracksData = await spotifyApiRequest('https://api.spotify.com/v1/me/top/tracks?limit=10');

    if (topTracksData && topTracksData.items && topTracksData.items.length > 0) {
        
        const randomIndex = Math.floor(Math.random() * topTracksData.items.length);
        const trackUri = topTracksData.items[randomIndex].uri;

       
        const playData = await spotifyApiRequest('https://api.spotify.com/v1/me/player/play', 'put', {
            uris: [trackUri]
        });

        if (playData && playData.error) {
            if (playData.details && playData.details.error && playData.details.error.status === 403) {
                return res.status(403).json({ error: 'Playback control requires a Spotify Premium account and an active device.' });
            }
            return res.status(400).json(playData);
        }

        res.json({ message: `Attempted to play a random top track at index ${randomIndex}. Check /spotify/now-playing for status.` });
    } else {
        res.status(404).json({ error: 'Could not find any top tracks to play.' });
    }
});

// Start the Express server
const DOMAIN=process.env.DOMAIN;

app.listen(port, () => {
    console.log(`Server running at ${DOMAIN}${port}`);
    console.log(`
        To use this API:
        1. Visit ${DOMAIN}${port}/spotify - Home
        2. Visit ${DOMAIN}${port}/spotify/login in your browser to authenticate with Spotify.
        3. After successful authentication, you can access the following endpoints:
           - GET ${DOMAIN}${port}/spotify/top-tracks
           - GET ${DOMAIN}${port}/spotify/now-playing
           - GET ${DOMAIN}${port}/spotify/followed-artists
           - POST ${DOMAIN}${port}/spotify/play-random-top-track (plays a random track from the top 10 list)
           - POST ${DOMAIN}${port}/spotify/stop (requires Content-Type: application/json)
    `);
});
