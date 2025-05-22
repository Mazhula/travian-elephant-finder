const excel = require('excel4node');
const cheerio = require('cheerio');
const jsonfile = require('jsonfile');
const NodeUnique = require('node-unique-array');
const cliProgress = require('cli-progress');
const config = require('../config');
const util = require('../services/util');
const travian = require('../services/travian');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const bar = new cliProgress.Bar();
  const workbook = new excel.Workbook();
  const worksheet = workbook.addWorksheet('Sheet 1', {});

  worksheet.cell(1, 1).string('x');
  worksheet.cell(1, 2).string('y');
  worksheet.cell(1, 3).string('Elephant');
  worksheet.cell(1, 4).string('Another animal');
  worksheet.cell(1, 5).string('hasCrocodile');
  worksheet.cell(1, 6).string('hasTiger');
  worksheet.cell(1, 7).string('totalAnimal');

  let oasisPositions = jsonfile.readFileSync(config.jsonFile.oasis);
  let oasisOccupied = jsonfile.readFileSync(config.jsonFile.oasisOccupied);

  if (!Array.isArray(oasisOccupied)) {
    oasisOccupied = [];
  }

  const uniqueOccupied = new NodeUnique();
  uniqueOccupied.add(oasisOccupied);

  oasisPositions = oasisPositions.filter(pos => !uniqueOccupied.contains(pos));

  oasisPositions = oasisPositions.map(obj => ({
    ...obj,
    distance: util.distance(obj.x, obj.y, config.coordinates.startX, config.coordinates.startY)
  })).sort((a, b) => a.distance - b.distance);

  let rowCounter = 2;
  const date = new Date();
  const fileNameAdd = `${date.toLocaleDateString().replaceAll('/', '-')}_${date.getTime()}`;
  const file = `data/elephant_${fileNameAdd}.xlsx`;

  util.createFile(file);
  bar.start(oasisPositions.length, 0);

  for (const { x, y } of oasisPositions) {
    try {
      const r = await travian.viewTileDetails(x, y);
      const data = r.data.html;
      const $ = cheerio.load(data);

      const table = $('#troop_info').first();
      const td = table.find(`img.${travian.animals.Elephants}`);
      const hasCrocodile = table.find(`img.${travian.animals.Crocodiles}`);
      const hasTiger = table.find(`img.${travian.animals.Tigers}`);
      const trCount = table.find('tr');

      let amount = 0;
      let anotherAnimal = 0;
      let totalAnimal = 0;

      if (td.length > 0) {
        anotherAnimal = trCount.length - 1;
        amount = parseInt(td.closest('tr').find('.val').text(), 10);

        const vals = table.find('td.val');
        vals.each((_, el) => {
          const val = parseInt($(el).text(), 10);
          if (!isNaN(val)) totalAnimal += val;
        });
      }

      if (amount > 0) {
        worksheet.cell(rowCounter, 1).number(x);
        worksheet.cell(rowCounter, 2).number(y);
        worksheet.cell(rowCounter, 3).number(amount);
        worksheet.cell(rowCounter, 4).number(anotherAnimal);
        worksheet.cell(rowCounter, 5).number(hasCrocodile.length);
        worksheet.cell(rowCounter, 6).number(hasTiger.length);
        worksheet.cell(rowCounter, 7).number(totalAnimal);
        rowCounter++;
        workbook.write(file);
      }

      const tileDetails = $('#tileDetails').first();
      if (tileDetails.hasClass('oasis-3')) {
        uniqueOccupied.add({ x, y });
        jsonfile.writeFileSync(config.jsonFile.oasisOccupied, uniqueOccupied.get());
      }

      bar.increment();
      await sleep(util.randomIntFromInterval(config.delay.min, config.delay.max));
    } catch (err) {
      console.warn(`❌ Error at x=${x}, y=${y}`, err.message);
    }
  }

  bar.stop();
  console.log(`✅ ${oasisPositions.length} oases processed`);
})();
