import puppeteer from "puppeteer";
import fs from "fs";
import { randomDelay } from "./utils.js";
import UserAgent from "user-agents";

// Example proxy list
const proxies = [
  "http://123.123.123.123:8080",
  "http://111.111.111.111:3128",
  "http://222.222.222.222:8000",
  // Add more proxies here
];

function getRandomProxy() {
  return proxies[Math.floor(Math.random() * proxies.length)];
}

export async function scrapeForMultipleUsers(users) {
  const allResults = [];

  for (const user of users) {
    const { email, password, url } = user;

    // Pick random proxy and user-agent
    const proxy = getRandomProxy();
    const ua = new UserAgent().toString();

    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        "--start-maximized",
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        `--proxy-server=${proxy}`, // <-- add proxy
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(ua); // <-- set random User-Agent

    try {
      console.log(`Logging in as ${email} using proxy ${proxy}`);
      await page.goto("https://www.linkedin.com/login", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await page.type("#username", email, { delay: 100 });
      await page.type("#password", password, { delay: 100 });
      await page.click('button[type="submit"]');

      await page.waitForSelector(".global-nav__primary-link", { timeout: 60000 });
      console.log("Login successful");

      console.log("Visiting profile:", url);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await randomDelay(2000, 4000);

      await autoScroll(page);

      const data = await page.evaluate(() => {
        const extractText = (selector) =>
          document.querySelector(selector)?.innerText?.trim() || "";

        const extractMultiple = (selector, max = 3) => {
          const elements = Array.from(document.querySelectorAll(selector));
          return elements.slice(0, max).map((el) => el.innerText.trim());
        };

        return {
          name: extractText("h1"),
          headline: extractText(".text-body-medium"),
          location: extractText(".text-body-small.inline"),
          about: extractText("#about ~ div div.display-flex.full-width > span"),
          experience: extractMultiple("#experience ~ div li .display-flex.flex-column.full-width"),
          education: extractMultiple("#education ~ div li .display-flex.flex-column.full-width"),
          skills: extractMultiple("span.pvs-list__paged-list-item__content"),
        };
      });

      const csvLine = `${email},"${data.name}","${data.headline}","${data.location}","${data.about}"\n`;
      fs.appendFileSync("./output/profiles.csv", csvLine);

      allResults.push({ email, ...data });
      console.log(`Scraped profile for ${data.name || email}`);
    } catch (err) {
      console.error(`Error scraping ${email}: ${err.message}`);
      allResults.push({ email, error: err.message });
    } finally {
      await page.close();
      await browser.close();
    }
  }

  return allResults;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
}
