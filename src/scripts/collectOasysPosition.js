const cheerio = require('cheerio');
const jsonfile = require('jsonfile');
const cliProgress = require('cli-progress');
const config = require('../config');
const util = require('../services/util');
const travian = require('../services/travian');

// Non-blocking sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const bar = new cliProgress.Bar();

  let oasisPosition = [];
  try {
    oasisPosition = jsonfile.readFileSync(config.jsonFile.oasis);
    if (!Array.isArray(oasisPosition)) {
      oasisPosition = [];
    }
  } catch (err) {
    console.warn('oasis.json not found, creating a new one.');
  }

  util.checkConfiguration();

  const startX = Math.min(+config.coordinates.minX, +config.coordinates.maxX);
  const endX = Math.max(+config.coordinates.minX, +config.coordinates.maxX);
  const startY = Math.min(+config.coordinates.minY, +config.coordinates.maxY);
  const endY = Math.max(+config.coordinates.minY, +config.coordinates.maxY);

  const totalFields = (endX - startX) * (endY - startY);
  bar.start(totalFields, 0);

  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      try {
        const response = await travian.viewTileDetails(x, y);
        const { html } = response.data;

        const $ = cheerio.load(html);
        const tileDetails = $('#tileDetails');
        const className = tileDetails.attr('class') || '';

        if (className.includes('oasis')) {
          oasisPosition.push({ x, y });
          jsonfile.writeFileSync(config.jsonFile.oasis, oasisPosition);
        }

        bar.increment();
        await sleep(util.randomIntFromInterval(+config.delay.min, +config.delay.max));
      } catch (err) {
        console.error(`Error at x=${x}, y=${y}:`, err);
      }
    }
  }

  bar.stop();
  console.log('✅ Collection complete');
})();
