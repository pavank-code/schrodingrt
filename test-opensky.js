import https from 'https';

https.get('https://opensky-network.org/api/states/all', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
    if (data.length > 500) {
      console.log(data.substring(0, 500));
      process.exit(0);
    }
  });
}).on('error', (err) => {
  console.error(err);
});
