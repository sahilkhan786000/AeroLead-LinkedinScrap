export const randomDelay = (min = 2000, max = 5000) =>
  new Promise(res => setTimeout(res, Math.random() * (max - min) + min));
