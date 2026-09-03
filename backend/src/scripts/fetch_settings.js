

async function main() {
  try {
    const res = await fetch('https://mcvzvgciqmcxqnxuvomw.supabase.co/auth/v1/settings');
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("=== Settings Data ===");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

main();
