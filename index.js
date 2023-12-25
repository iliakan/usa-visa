const execSync = require('child_process').execSync;
const puppeteer = require('puppeteer');
const request = require('request-promise');
const util = require('node:util');
util.inspect.defaultOptions.depth = 10;

let browser;
let page;

function log(...args) {
  console.log(new Date(), ...args);
}

const APPOINTMENT_URL = 'https://ais.usvisa-info.com/en-nl/niv/schedule/51069667/appointment/days/43.json?appointments[expedite]=false';

// maybe APPOINTMENT_URL_REFERER=APPOINTMENT_URL will also be ok, didn't check
const APPOINTMENT_URL_REFERER = 'https://ais.usvisa-info.com/en-nl/niv/schedule/51069667/appointment?utf8=%E2%9C%93&applicants%5B%5D=59551424&applicants%5B%5D=59551516&confirmed_limit_message=1&commit=Continue';

async function login() {
  await page.goto('https://ais.usvisa-info.com/en-nl/niv/users/sign_in');
  await page.type('[name="user[email]"]', process.env.USA_USER);
  await page.type('[name="user[password]"]', process.env.USA_PASSWD);
  await page.click('[name="policy_confirmed"]');
  await page.click('[name="commit"]');
  await page.waitForSelector('.application.success');
}

async function fetchDates() {
  const result = await page.evaluate(async () => {
    let response = await fetch(APPOINTMENT_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': APPOINTMENT_URL_REFERER,
        'X-CSRF-Token': document.querySelector('meta[name=csrf-token]').content,
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    let json = await response.text();
    return json;
  });

  log("TEXT: ", result);

  let json = JSON.parse(result);

  if (Array.isArray(json) && json.length == 0) {
    return false;
  }

  let date1 = json[0].date;

  log("DATE1: ", date1, new Date(date1));

  date1 = new Date(date1);

  if (date1 < new Date('2024-04-04')) {
    notify({
      message: "USA VISA",
      title: date1
    });
    execSync('mplayer -loop 0 /System/Library/Sounds/Glass.aiff > /dev/null 2>&1');
  }

  return true;
}

async function run() {
  browser = await puppeteer.launch({
    headless: false
  });

  page = await browser.newPage();

  await login();

  let waitTime;

  while(true) {
    try {
      let hasDates = await fetchDates();

      // always shows "no appointments" in some periods
      // then we wait longer
      waitTime = hasDates ? 10e3 : 200e3;

    } catch(err) {
      console.error(err);
      notify({
        title: err.message,
        message: err.stack
      });
      if (page.isClosed) {
        page = await browser.newPage();
        await login();
      }
    }
    await new Promise(res => setTimeout(res, waitTime));
  }

}

function notify({
  message,
  title
}) {
  execSync(`osascript -e 'display notification "${message}" with title "${title}" sound name "Pop"'`);
}


run();
