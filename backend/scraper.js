import puppeteer from "puppeteer";
import fs from "fs";
import { randomDelay } from "./utils.js";

export async function scrapeForMultipleUsers(users) {
  const allResults = [];
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  for (const user of users) {
    const { email, password, url } = user;
    const page = await browser.newPage();
    try {
      console.log(`Logging in as ${email}`);

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

      // Scroll down to load more sections dynamically
      await autoScroll(page);

      const data = await page.evaluate(() => {
        const extractText = (selector) => document.querySelector(selector)?.innerText?.trim() || "";
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
    }
  }

  await browser.close();
  return allResults;
}

// Helper: auto-scroll down the page to load all lazy sections
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
