import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

const key = process.env.VITE_AVIATIONSTACK_API_KEY;
http.get(`http://api.aviationstack.com/v1/flights?access_key=${key}&limit=5`, (res) => {
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
