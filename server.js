const express = require("express");
const session = require("express-session");
const fetch = require("node-fetch");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const config = require("./config.json");

const app = express();
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "911-police-mod",
  resave: false,
  saveUninitialized: false
}));

// Discord Bot
const bot = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});
bot.login(config.BOT_TOKEN);

// منع إعادة الاختبار
const testedUsers = new Set();

// الأسئلة
const questions = [
  { q: "ما هو VDM؟", a: ["صدم عشوائي"] },
  { q: "ما هو RDM؟", a: ["قتل عشوائي"] },
  { q: "ماهو الرول بلاي؟", a: ["تقمص الشخصية"] },
  { q: "هل تعود لنفس موقع السيناريو بعد الإصابة؟", a: ["غير صحيح", "لا"] },
  { q: "في الاستيقاف المروري الدورية تكون من؟", a: ["من الخلف"] },
  { q: "متى يتم استيقاف الدورية من الأمام؟", a: ["الحالات الطارئة"] },
  { q: "هل رئيس رقباء يحق له اطلاق اصطفاف؟", a: ["غير صحيح", "لا"] },
  { q: "متى يحق لك العرقلة في المطاردة؟", a: ["بعد 5 دقائق"] },
  { q: "هل يحق قطع بلاغ زميلك؟", a: ["غير صحيح", "لا"] },
  { q: "متى يحق قطع الإشارة؟", a: ["الحالات الجنائية"] }
];

function checkAnswer(user, valid) {
  if (!user) return false;
  user = user.toLowerCase();
  return valid.some(v => user.includes(v));
}

// الصفحات
app.get("/", (req, res) =>
  res.sendFile(__dirname + "/views/index.html")
);

app.get("/login", (req, res) => {
  res.redirect(
    `https://discord.com/api/oauth2/authorize?client_id=${config.CLIENT_ID}&redirect_uri=${config.REDIRECT_URI}&response_type=code&scope=identify`
  );
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  const token = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.CLIENT_ID,
      client_secret: config.CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.REDIRECT_URI
    })
  }).then(r => r.json());

  const user = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` }
  }).then(r => r.json());

  req.session.user = user;
  res.sendFile(__dirname + "/views/quiz.html");
});

// إرسال الاختبار
app.post("/quiz", async (req, res) => {
  const userId = req.session.user.id;

  if (testedUsers.has(userId)) {
    return res.send("❌ لا يمكنك إعادة الاختبار");
  }

  let correct = 0;
  questions.forEach((q, i) => {
    if (checkAnswer(req.body["q" + i], q.a)) correct++;
  });

  const percent = Math.round((correct / questions.length) * 100);
  testedUsers.add(userId);

  const guild = await bot.guilds.fetch(config.GUILD_ID);
  const log = await guild.channels.fetch(config.LOG_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle("📋 نتيجة اختبار تفعيل الشرطة")
    .setAuthor({
      name: "911[POLICE MOD]",
      iconURL: "https://cdn.discordapp.com/attachments/1451749051283537930/1451751023516319805/512_1.gif"
    })
    .setColor(percent >= 70 ? 0x2ecc71 : 0xe74c3c)
    .addFields(
      { name: "👤 المتقدم", value: `<@${userId}>`, inline: true },
      { name: "📊 النتيجة", value: `${percent}%`, inline: true },
      { name: "✅ الصحيحة", value: `${correct}/${questions.length}`, inline: true },
      { name: "📌 الحالة", value: percent >= 70 ? "🟢 ناجح" : "🔴 راسب" }
    )
    .setImage("https://cdn.discordapp.com/attachments/1451749051283537930/1451751023516319805/512_1.gif")
    .setFooter({ text: "911[POLICE MOD]" })
    .setTimestamp();

  log.send({ embeds: [embed] });

  if (percent >= 70) {
    const member = await guild.members.fetch(userId);
    await member.roles.add(config.ROLE_ID);
  }

  res.sendFile(__dirname + "/views/result.html");
});

app.listen(3000, () =>
  console.log("✅ الموقع شغال: http://localhost:3000")
);
