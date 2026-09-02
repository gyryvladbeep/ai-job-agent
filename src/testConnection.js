const supabase = require("./services/supabase");

async function test() {
    const { data, error } = await supabase
        .from("vacancies")
        .select("*");

    if (error) {
        console.error("❌ Connection failed");
        console.error(error);
        return;
    }

    console.log("✅ Connected to Supabase!");
    console.table(data);
}

test(); I sounds.