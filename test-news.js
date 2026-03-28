import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

const key = process.env.VITE_WORLD_NEWS_API_KEY;
https.get(`https://api.worldnewsapi.com/search-news?api-key=${key}&text=supply%20chain&number=2`, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => {
  console.error(err);
});
