const { chromium } = require("playwright");

async function getTelegramQaJobs() {
    console.log("📨 Opening Telegram QA channel...");

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage();

    try {
        await page.goto(
            "https://t.me/s/qa_chillout_jobs",
            {
                waitUntil: "domcontentloaded",
                timeout: 30000
            }
        );

        console.log("📨 Telegram channel loaded");

        await page.waitForTimeout(2000);

        const messages = page.locator(
            ".tgme_widget_message_wrap"
        );

        const count = await messages.count();

        console.log(`📨 Found ${count} Telegram messages`);

        const jobs = [];

        for (let i = 0; i < count; i++) {
            const message = messages.nth(i);

            const textElement = message
                .locator(".tgme_widget_message_text")
                .first();

            if (await textElement.count() === 0) {
                continue;
            }

            const text = (
                await textElement.innerText()
            ).trim();

            if (!text) {
                continue;
            }

            const messageLink = message
                .locator("a.tgme_widget_message_date")
                .first();

            let messageUrl = null;

            if (await messageLink.count() > 0) {
                messageUrl =
                    await messageLink.getAttribute("href");
            }

            const links = message.locator("a");
            const linkCount = await links.count();

            let externalUrl = null;

            for (let j = 0; j < linkCount; j++) {
                const link = links.nth(j);

                const href =
                    await link.getAttribute("href");

                if (!href) {
                    continue;
                }

                if (
                    href.startsWith("http") &&
                    !href.includes("t.me/")
                ) {
                    externalUrl = href;
                    break;
                }
            }

            const lowerText = text.toLowerCase();

            const isQaJob =
                lowerText.includes("qa") ||
                lowerText.includes("тестировщик") ||
                lowerText.includes("тестировщика") ||
                lowerText.includes("quality assurance");

            if (!isQaJob) {
                continue;
            }

            if (!messageUrl) {
                continue;
            }

            jobs.push({
                company: extractCompany(text),
                position: extractPosition(text),
                description: text,
                url: externalUrl || messageUrl,
                source: "Telegram: @qa_chillout_jobs"
            });
        }

        console.log(
            `🎯 Telegram QA jobs collected: ${jobs.length}`
        );

        return jobs;

    } catch (error) {
        console.error("❌ Telegram parser error:");
        console.error(error.message);

        return [];

    } finally {
        await browser.close();
    }
}

function extractCompany(text) {
    const patterns = [
        /Компания\s*[:\-]\s*(.+)/i,
        /Company\s*[:\-]\s*(.+)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match) {
            return match[1]
                .split("\n")[0]
                .trim();
        }
    }

    return "Unknown";
}

function extractPosition(text) {
    const patterns = [
        /Должность\s*[:\-]\s*(.+)/i,
        /Вакансия\s*[:\-]\s*(.+)/i,
        /Position\s*[:\-]\s*(.+)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match) {
            return match[1]
                .split("\n")[0]
                .trim();
        }
    }

    const firstLine = text
        .split("\n")
        .map(line => line.trim())
        .find(Boolean);

    return firstLine || "QA Engineer";
}

module.exports = {
    getTelegramQaJobs
};