# ঋণ অ্যাপ — সেটআপ (একবারই, প্রায় ২০ মিনিট, খরচ ০ টাকা)

## ধাপ ১: GitHub-এ আপলোড
1. github.com → New repository → নাম `rin` → **Public** → Create।
2. "uploading an existing file" চাপুন → এই ZIP-এর ভেতরের সব ফাইল/ফোল্ডার (সবগুলো, কোনো ফোল্ডার নেই) সিলেক্ট করে দিন → Commit।
3. Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `/ (root)` → Save।
4. ১-২ মিনিট পর লিংক পাবেন: `https://আপনার-ইউজারনেম.github.io/rin/`

## ধাপ ২: গুগল Client ID (লগিন, ড্রাইভ, ক্যালেন্ডারের জন্য)
1. console.cloud.google.com → নতুন Project (নাম: rin)।
2. **APIs & Services → Library** → "Google Drive API" ও "Google Calendar API" দুটোই Enable।
3. **OAuth consent screen** → External → অ্যাপের নাম দিন, নিজের ইমেইল দিন → Save। Scopes ধাপে `.../auth/drive.appdata` ও `.../auth/calendar.events` যোগ করুন। **Test users**-এ নিজের Gmail (ও যাকে অ্যাপ দেবেন তার Gmail) যোগ করুন। Publishing status "Testing"-ই থাকুক।
4. **Credentials → Create credentials → OAuth client ID** → Web application → **Authorized JavaScript origins**-এ দিন: `https://আপনার-ইউজারনেম.github.io` (শেষে `/rin` বা স্ল্যাশ দেবেন না) → Create।
5. যে Client ID পাবেন (`...apps.googleusercontent.com`) সেটি `config.js` ফাইলে `YOUR_CLIENT_ID.apps.googleusercontent.com`-এর জায়গায় বসিয়ে GitHub-এ ফাইলটি Edit → Commit।

## ধাপ ৩: ফোনে ইনস্টল
1. ফোনের Chrome-এ লিংক খুলুন → ⋮ → **Add to Home screen / Install app**।
2. অ্যাপ খুলে **সেটিং → গুগল দিয়ে লগিন**। "Google hasn't verified this app" দেখালে Advanced → Continue (এটি আপনার নিজের অ্যাপ, স্বাভাবিক)। দুটো অনুমতিই দিন।
3. **সেটিং → পরীক্ষামূলক রিমাইন্ডার পাঠান** — ৫ মিনিট পরে নোটিফিকেশন এলে সব ঠিক।
4. ফোনের Calendar অ্যাপে নোটিফিকেশন চালু আছে কিনা দেখে নিন।

## জরুরি টিপ
- মাঝে মাঝে **সেটিং → ব্যাকআপ ডাউনলোড** করে রাখুন।
- ডাটা ড্রাইভের গোপন ফোল্ডারে থাকে, Drive অ্যাপে দেখা যাবে না — এটাই স্বাভাবিক।
- অন্য ফোনে একই লিংক খুলে একই Gmail দিয়ে লগিন করলে একই ডাটা আসবে।
- অন্য কাউকে দিতে চাইলে তার Gmail Test users-এ যোগ করুন (সর্বোচ্চ ১০০ জন); সে নিজের ডাটা আলাদা পাবে।
- ইন্টারনেট ছাড়াও অ্যাপ চলে; নেট এলে সিঙ্ক হয়। পিডিএফ বানাতে প্রথমবার ইন্টারনেট লাগে।
- চুক্তিপত্র একটি সাধারণ টেমপ্লেট, আইনি পরামর্শ নয়।
