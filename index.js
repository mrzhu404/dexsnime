const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const searchQuery = req.query.q;

  try {
    const searchUrl = `https://layaranime.com/?s=${encodeURIComponent(searchQuery)}`;
    const searchResponse = await axios.get(searchUrl);
    const $ = cheerio.load(searchResponse.data);

    const results = [];

    const animePromises = $('article.min-h-full').map(async (i, animeElement) => {
      const animeTitle = $(animeElement).find('header h4 a').text().trim();
      const animeLink = $(animeElement).find('figure a').attr('href');
      const imageLink = $(animeElement).find('figure img').attr('src');

      const episodes = [];

      try {
        const detailResponse = await axios.get(animeLink);
        const $$ = cheerio.load(detailResponse.data);

        const episodePromises = $$('.bg-c-primary .grid a').map(async (j, episodeElement) => {
          const episodeNumber = $$(episodeElement).text().trim();
          const episodeLink = $$(episodeElement).attr('href');

          try {
            const episodeResponse = await axios.get(episodeLink);
            const $$$ = cheerio.load(episodeResponse.data);

            const playerData = $$$('#player').attr('x-data');
            let s1DirectLinks = [];

            if (playerData) {
              const s1DirectMatch = playerData.match(/"S2_CEPAT":\s*([^]+)/);

              if (s1DirectMatch) {
                const s1DirectData = JSON.parse(s1DirectMatch[1]);
                s1DirectLinks = s1DirectData.map((url) => decodeURIComponent(url));
              }
            }

            episodes.push({ episodeNumber, episodeLink, s1DirectLinks });
          } catch (error) {
            console.error(`Gagal memuat episode ${episodeNumber}: ${error.message}`);
          }
        }).get();

        await Promise.all(episodePromises);
      } catch (error) {
        console.error(`Gagal memuat detail untuk ${animeTitle}: ${error.message}`);
      }

      results.push({ animeTitle, animeLink, imageLink, episodes });
    }).get();

    await Promise.all(animePromises);

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: "Gagal mendapatkan data" });
  }
};
