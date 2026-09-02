const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");

require("dotenv").config();

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

const stringSession = new StringSession(
    process.env.TELEGRAM_STRING_SESSION || ""
);

async function getTelegramQaJobs() {
    console.log("📨 Opening Telegram QA channel...");

    const client = new TelegramClient(
        stringSession,
        apiId,
        apiHash,
        {
            connectionRetries: 5
        }
    );

    const jobs = [];

    try {
        await client.start({
            phoneNumber: async () => {
                return await input.text("📱 Enter Telegram phone number: ");
            },
            password: async () => {
                return await input.text("🔐 Enter Telegram 2FA password: ");
            },
            phoneCode: async () => {
                return await input.text("📨 Enter Telegram login code: ");
            },
            onError: (error) => {
                console.error("❌ Telegram login error:", error);
            }
        });

        console.log("✅ Telegram client connected");

        const channel = await client.getEntity("qa_jobs");

        const messages = await client.getMessages(channel, {
            limit: 50
        });

        console.log(`📨 Found ${messages.length} Telegram messages`);

        for (const message of messages) {
            if (!message.message) {
                continue;
            }

            const text = message.message.trim();

            if (!text) {
                continue;
            }

            const normalized = text.toLowerCase();

            const qaKeywords = [
                "qa engineer",
                "qa automation",
                "automation qa",
                "automation tester",
                "test engineer",
                "test automation",
                "software tester",
                "quality assurance",
                "sdet",
                "manual qa",
                "manual tester",
                "тестировщик",
                "тестировщ",
                "инженер по тестированию",
                "инженер qa",
                "автоматизатор тестирования",
                "специалист по тестированию"
            ];

            const isQa = qaKeywords.some(keyword =>
                normalized.includes(keyword)
            );

            if (!isQa) {
                continue;
            }

            let position = "QA vacancy";

            const lines = text
                .split("\n")
                .map(line => line.trim())
                .filter(Boolean);

            if (lines.length > 0) {
                position = lines[0]
                    .replace(/^[-•🔥🚀⭐️✅🆕]+/g, "")
                    .trim();
            }

            let company = "Unknown";

            const companyMatch = text.match(
                /(?:company|компания|компании)\s*[:\-]\s*(.+)/i
            );

            if (companyMatch) {
                company = companyMatch[1].trim();
            }

            const url = `https://t.me/qa_jobs/${message.id}`;

            jobs.push({
                company,
                position,
                description: text,
                url,
                source: "Telegram: @qa_jobs"
            });
        }

        const uniqueJobs = [
            ...new Map(
                jobs.map(job => [job.url, job])
            ).values()
        ];

        console.log(
            `🎯 Telegram @qa_jobs QA jobs collected: ${uniqueJobs.length}`
        );

        console.table(uniqueJobs);

        return uniqueJobs;

    } catch (error) {
        console.error("❌ Telegram @qa_jobs parser error:");
        console.error(error);

        return [];

    } finally {
        await client.disconnect();
    }
}

module.exports = {
    getTelegramQaJobs
};