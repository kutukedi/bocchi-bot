require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fetch = require('node-fetch'); // npm install node-fetch@2

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Bot hazır olduğunda
client.once('ready', () => {
    console.log(`Bot giriş yaptı: ${client.user.tag}`);
    client.user.setActivity("Bocchi'nin Hayalleri ile");
});

// Slash komutları
const commands = [
    new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Kullanıcının avatarını gösterir')
        .addUserOption(opt => opt.setName('kullanıcı').setDescription('Kimin avatarı?').setRequired(false)),
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Üyeyi yasaklar')
        .addUserOption(opt => opt.setName('kullanıcı').setDescription('Banlanacak kullanıcı').setRequired(true)),
    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Üyenin banını kaldırır')
        .addUserOption(opt => opt.setName('kullanıcı').setDescription('Unban yapılacak kullanıcı').setRequired(true)),
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Üyeyi atar')
        .addUserOption(opt => opt.setName('kullanıcı').setDescription('Kicklenecek kullanıcı').setRequired(true)),
    new SlashCommandBuilder()
        .setName('to')
        .setDescription('Üyeyi süreli susturur')
        .addUserOption(opt => opt.setName('kullanıcı').setDescription('Susturulacak kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Süre (örn: 10m, 1h)').setRequired(true)),
    new SlashCommandBuilder()
        .setName('nto')
        .setDescription('Susturmayı kaldırır')
        .addUserOption(opt => opt.setName('kullanıcı').setDescription('Susturması kaldırılacak kullanıcı').setRequired(true)),
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Mesaj siler')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Silinecek mesaj sayısı').setRequired(true))
].map(c => c.toJSON());

// Slash komutlarını kaydet
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
    try {
        console.log('Slash komutlar güncelleniyor...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('Slash komutlar güncellendi.');
    } catch (err) {
        console.error(err);
    }
})();

// Slash komutları dinle
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const member = interaction.member;

    try {
        switch (interaction.commandName) {
            case 'avatar': {
                const user = interaction.options.getUser('kullanıcı') || interaction.user;
                const guildMember = interaction.guild.members.cache.get(user.id);
                await interaction.reply({
                    embeds: [{
                        title: `${guildMember.displayName} adlı kullanıcının avatarı`,
                        image: { url: user.displayAvatarURL({ size: 1024 }) },
                        color: 0x00AE86
                    }]
                });
                break;
            }
            case 'ban': {
                if (!member.permissions.has(PermissionFlagsBits.BanMembers))
                    return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
                const target = interaction.options.getMember('kullanıcı');
                await target.ban({ reason: 'Sunucudan yasaklandı!' });
                interaction.reply({ content: `${target.user.tag} yasaklandı!`, ephemeral: true });
                break;
            }
            case 'unban': {
                if (!member.permissions.has(PermissionFlagsBits.BanMembers))
                    return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
                const target = interaction.options.getUser('kullanıcı');
                await interaction.guild.bans.remove(target.id);
                interaction.reply({ content: `${target.tag} artık banlı değil!`, ephemeral: true });
                break;
            }
            case 'kick': {
                if (!member.permissions.has(PermissionFlagsBits.KickMembers))
                    return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
                const target = interaction.options.getMember('kullanıcı');
                await target.kick('Sunucudan atıldı!');
                interaction.reply({ content: `${target.user.tag} atıldı!`, ephemeral: true });
                break;
            }
            case 'to': {
                if (!member.permissions.has(PermissionFlagsBits.ModerateMembers))
                    return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
                const target = interaction.options.getMember('kullanıcı');
                const durationStr = interaction.options.getString('duration');
                const durationMs = parseDuration(durationStr);
                await target.timeout(durationMs, 'Süreli susturma');
                interaction.reply({ content: `${target.user.tag} susturuldu! Süre: ${durationStr}`, ephemeral: true });
                break;
            }
            case 'nto': {
                if (!member.permissions.has(PermissionFlagsBits.ModerateMembers))
                    return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
                const target = interaction.options.getMember('kullanıcı');
                await target.timeout(null);
                interaction.reply({ content: `${target.user.tag} artık susturulmuyor!`, ephemeral: true });
                break;
            }
            case 'clear': {
                if (!member.permissions.has(PermissionFlagsBits.ManageMessages))
                    return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
                const amount = interaction.options.getInteger('amount');
                if (amount < 1 || amount > 100) return interaction.reply({ content: '1 ile 100 arasında bir sayı gir!', ephemeral: true });
                const messages = await interaction.channel.messages.fetch({ limit: amount });
                await interaction.channel.bulkDelete(messages);
                interaction.reply({ content: `${amount} mesaj silindi!`, ephemeral: true });
                break;
            }
        }
    } catch (err) {
        console.error(err);
        interaction.reply({ content: 'Bir hata oluştu!', ephemeral: true });
    }
});

// Normal mesaj tabanlı komutlar
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const msg = message.content.toLowerCase();

    // Ping komutu
    if (msg === 'ping') {
        const sent = await message.channel.send('🏓 Pong!');
        const latency = sent.createdTimestamp - message.createdTimestamp;
        sent.edit(`🏓 Pong! Gecikme: ${latency}ms`);
    }

    // Bocchi komutu (random Tenor GIF)
    if (msg.includes('bocchi')) {
        const TENOR_KEY = process.env.TENOR_KEY;
        const url = `https://tenor.googleapis.com/v2/search?q=bocchi&key=${TENOR_KEY}&limit=50&random=true`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const gifUrl = data.results[0].media_formats.gif.url;
                message.channel.send({ content: gifUrl });
            } else {
                message.channel.send('Gif bulunamadı 😢');
            }
        } catch (err) {
            console.error(err);
            message.channel.send('Gif alınamadı 😢');
        }
    }
});

// Ctrl+C ile botu kapat
process.on('SIGINT', () => {
    console.log('Bot kapatılıyor...');
    client.destroy();
    process.exit();
});

// Bot login
client.login(process.env.TOKEN);

// Süreyi milisaniyeye çevir
function parseDuration(input) {
    if (input.endsWith('m')) return parseInt(input.replace('m',''))*60*1000;
    if (input.endsWith('h')) return parseInt(input.replace('h',''))*60*60*1000;
    return parseInt(input)*1000;
}
