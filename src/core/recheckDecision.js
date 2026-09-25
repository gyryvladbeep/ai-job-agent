/*
 * Чистая функция без побочных эффектов -- вынесена отдельно от
 * src/recheckVacancies.js, чтобы её можно было протестировать через
 * node:test, не подключая services/supabase.js и services/telegram.js.
 * Оба этих файла обращаются к переменным окружения прямо при импорте
 * (создают клиента Supabase / бота Telegram) и падают в окружении без
 * настоящего .env -- например в CI или в песочнице. Вынос этой одной
 * строчки логики в отдельный модуль позволяет тестировать её без
 * таких побочных эффектов.
 */

function decideAction(isLive) {
    return isLive ? "resend" : "delete";
}

module.exports = {
    decideAction
};
