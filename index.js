require('dotenv').config();

const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder, 
    ChannelType, 
    PermissionsBitField,
    StringSelectMenuBuilder,
    REST,
    Routes,
    SlashCommandBuilder,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [ 
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages 
    ],
    partials: [Partials.Channel]
});

if (!process.env.DISCORD_TOKEN) {
    console.error('ERRO: DISCORD_TOKEN não configurado. Por favor, configure no arquivo .env');
    process.exit(1);
}

const TOKEN = process.env.DISCORD_TOKEN;
const CONFIG_FILE = path.join(__dirname, 'config.json');

let config = {
    orderCategoryId: "1499245949069951099",
    supportRoleId: "1499925488116695120",
    pixKey: null,
    openOrdersLogChannel: null,
    closedOrdersLogChannel: null
};

const customEmojis = {
    error: "<a:TickRed:1435866005942566962>",
    success: "<a:TickGreen:1435865654770274367>",
    money: "<:k0111:1410699501425131540>",
    card: "<:emoji_11:1436113760971395102>",
    hourglass: "<a:loading:1435863836606468177>",
    party: "<a:celebration1:1436054927179907106>",
    package: "<:emoji_12:1436173909253951600>",
    settings: "<:emoji_13:1436175594479026308>",
    worker: "👷",
    bell: "🔔",
    progressFilled: "🟩",
    progressEmpty: "⬜",
    pin: "🔄",
    yellow: "🟡",
    checkmark: "✔️",
    arrowLeft: "⬅️",
    arrowRight: "➡️",
    box: "<:emoji_20:1436214253265621004>",
    fab: "<:emoji_18:1436213039161544705>",
    x: "<:emoji_16:1436203715223617658>",
    mais: "<:emoji_20:1436213078948839487>",
    copiar: "📋"
};

const channelPaymentStatus = new Map();
const userActiveChannels = new Map();
const orderValues = new Map();

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            const savedConfig = JSON.parse(data);
            config = { ...config, ...savedConfig };
            console.log('Configurações carregadas do arquivo.');
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        console.log('Configurações salvas no arquivo.');
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
    }
}

loadConfig();

async function registerSlashCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('encomenda')
            .setDescription('Inicia o sistema de encomendas'),
        new SlashCommandBuilder()
            .setName('listar')
            .setDescription('Lista todas as encomendas ativas'),
        new SlashCommandBuilder()
            .setName('configpix')
            .setDescription('Configura a chave PIX para pagamentos'),
        new SlashCommandBuilder()
            .setName('logs')
            .setDescription('Configura os canais de logs'),
        new SlashCommandBuilder()
            .setName('close')
            .setDescription('Fecha o canal de encomenda atual'),
        new SlashCommandBuilder()
            .setName('suporte')
            .setDescription('Configura o cargo de suporte'),
        new SlashCommandBuilder()
            .setName('categoria')
            .setDescription('Configura a categoria de encomendas')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('Registrando comandos slash...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Comandos slash registrados com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar comandos slash:', error);
    }
}

function sanitizeUsername(username) {
    let sanitized = username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
    
    if (!sanitized || sanitized === '-') {
        sanitized = 'usuario';
    }
    
    return sanitized;
}

client.once('ready', async () => {
    console.log(`Bot online como ${client.user.tag}`);
    await registerSlashCommands();
});

client.on('messageCreate', async (message) => {
    if(message.author.bot) return;
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'encomenda') {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Você não tem permissão para usar este comando.`, 
                    ephemeral: true 
                });
            }

            if (!config.orderCategoryId) {
                return interaction.reply({ 
                    content: `${customEmojis.error} A categoria de encomendas não foi configurada. Use \`/categoria\` para configurar.`, 
                    ephemeral: true 
                });
            }

            if (!config.supportRoleId) {
                return interaction.reply({ 
                    content: `${customEmojis.error} O cargo de suporte não foi configurado. Use \`/suporte\` para configurar.`, 
                    ephemeral: true 
                });
            }

            const orderEmbed = new EmbedBuilder()
                .setTitle("Solicitar Produtos para Estoque")
                .setDescription("**Como funciona?**\nAo clicar no botão, você poderá descrever o produto que gostaria de ver disponível na loja. Sua solicitação será enviada para os administradores.\n\n**Atenção**\nPor favor, forneça detalhes claros sobre o produto desejado para facilitar a análise da equipe.")
                .setColor(0x2ECC71);

            const orderButton = new ButtonBuilder()
                .setCustomId("order_button")
                .setLabel("Fazer Encomenda")
                .setStyle(ButtonStyle.Primary);
            
            const row = new ActionRowBuilder().addComponents(orderButton);
            
            await interaction.deferReply({ ephemeral: true });
            await interaction.channel.send({ embeds: [orderEmbed], components: [row] });
            return await interaction.deleteReply();
        }

        if (commandName === 'listar') {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Você não tem permissão para listar encomendas.`, 
                    ephemeral: true 
                });
            }

            const guild = interaction.guild;
            if(!guild) return;
            
            const channels = guild.channels.cache.filter(ch => 
                ch.name.startsWith("📦-encomenda") ||
                ch.name.startsWith("🟡-producao") ||
                ch.name.startsWith("✅-finalizado")
            );
            
            if(channels.size === 0){
                return interaction.reply({ 
                    content: "Nenhuma encomenda ativa encontrada.", 
                    ephemeral: true 
                });
            }
            
            let listMsg = "**Encomendas ativas:**\n";
            channels.forEach(ch => {
                listMsg += `- ${ch.name}\n`;
            });
            
            return interaction.reply({ content: listMsg, ephemeral: true });
        }

        if (commandName === 'configpix') {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Você não tem permissão para configurar a chave PIX.`, 
                    ephemeral: true 
                });
            }

            const currentPixKey = config.pixKey || "Nenhuma chave configurada";
            
            const pixEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.settings} Configuração de Chave PIX`)
                .setDescription("Configure a chave PIX que será exibida aos clientes no momento do pagamento.")
                .setColor(0x9B59B6)
                .addFields({ name: "Chave Atual", value: `\`${currentPixKey}\``, inline: false });

            return await interaction.reply({ 
                embeds: [pixEmbed],
                content: "Clique no botão abaixo para configurar ou alterar a chave PIX.", 
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("open_config_pix")
                            .setLabel("Configurar PIX")
                            .setEmoji(customEmojis.settings)
                            .setStyle(ButtonStyle.Primary)
                    )
                ],
                ephemeral: true
            });
        }

        if (commandName === 'logs') {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Você não tem permissão para configurar canais de logs.`, 
                    ephemeral: true 
                });
            }

            const guild = interaction.guild;
            if (!guild) return;

            const logsEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.settings} Configuração de Canais de Logs`)
                .setDescription("Configure os canais onde serão registrados os logs de encomendas abertas e fechadas.")
                .setColor(0x9B59B6)
                .addFields(
                    { name: "Canal de Encomendas Abertas", value: config.openOrdersLogChannel ? `<#${config.openOrdersLogChannel}>` : "Não configurado", inline: true },
                    { name: "Canal de Encomendas Fechadas", value: config.closedOrdersLogChannel ? `<#${config.closedOrdersLogChannel}>` : "Não configurado", inline: true }
                )
                .setFooter({ text: "Clique nos botões abaixo para configurar" });

            const openLogsButton = new ButtonBuilder()
                .setCustomId("config_open_logs")
                .setLabel("Configurar Canal Abertas")
                .setEmoji(customEmojis.settings)
                .setStyle(ButtonStyle.Primary);

            const closedLogsButton = new ButtonBuilder()
                .setCustomId("config_closed_logs")
                .setLabel("Configurar Canal Fechadas")
                .setEmoji(customEmojis.settings)
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(openLogsButton, closedLogsButton);

            return interaction.reply({ embeds: [logsEmbed], components: [row], ephemeral: true });
        }

        if (commandName === 'close') {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Você não tem permissão para fechar canais.`, 
                    ephemeral: true 
                });
            }

            const channel = interaction.channel;
            if(!channel || !channel.name) return;

            if(!channel.name.includes('encomenda') && !channel.name.includes('producao') && !channel.name.includes('finalizado')){
                return interaction.reply({ 
                    content: "Este comando só pode ser usado em canais de encomenda.", 
                    ephemeral: true 
                });
            }

            const confirmEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.error} Confirmar Fechamento`)
                .setDescription("Tem certeza que deseja fechar este canal? Esta ação não pode ser desfeita.")
                .setColor(0xE74C3C);

            const confirmButton = new ButtonBuilder()
                .setCustomId("confirm_close_channel")
                .setLabel("Confirmar")
                .setEmoji(customEmojis.checkmark)
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId("cancel_close_channel")
                .setLabel("Cancelar")
                .setEmoji(customEmojis.error)
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            return interaction.reply({ embeds: [confirmEmbed], components: [row] });
        }

        if (commandName === 'suporte') {
            if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Você não tem permissão para configurar o cargo de suporte.`, 
                    ephemeral: true 
                });
            }

            const currentRole = config.supportRoleId ? `<@&${config.supportRoleId}>` : "Nenhum cargo configurado";
            
            const supportEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.settings} Configuração do Cargo de Suporte`)
                .setDescription("Configure qual cargo terá permissões de suporte para gerenciar encomendas.")
                .setColor(0x9B59B6)
                .addFields({ name: "Cargo Atual", value: currentRole, inline: false })
                .setFooter({ text: "Mencione o cargo ou forneça o ID do cargo" });

            return await interaction.reply({ 
                embeds: [supportEmbed],
                content: "Clique no botão abaixo para configurar o cargo de suporte.", 
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("open_config_support")
                            .setLabel("Configurar Cargo de Suporte")
                            .setEmoji(customEmojis.settings)
                            .setStyle(ButtonStyle.Primary)
                    )
                ],
                ephemeral: true
            });
        }

        if (commandName === 'categoria') {
            if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Você não tem permissão para configurar a categoria de encomendas.`, 
                    ephemeral: true 
                });
            }

            const currentCategory = config.orderCategoryId ? `<#${config.orderCategoryId}>` : "Nenhuma categoria configurada";
            
            const categoryEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.settings} Configuração da Categoria de Encomendas`)
                .setDescription("Configure em qual categoria os canais de encomenda serão criados.")
                .setColor(0x9B59B6)
                .addFields({ name: "Categoria Atual", value: currentCategory, inline: false })
                .setFooter({ text: "Forneça o ID da categoria" });

            return await interaction.reply({ 
                embeds: [categoryEmbed],
                content: "Clique no botão abaixo para configurar a categoria de encomendas.", 
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("open_config_category")
                            .setLabel("Configurar Categoria")
                            .setEmoji(customEmojis.settings)
                            .setStyle(ButtonStyle.Primary)
                    )
                ],
                ephemeral: true
            });
        }
    }
    
    if (interaction.isButton()) {
        if (interaction.customId === "order_button") {
            const modal = new ModalBuilder()
                .setCustomId("order_modal")
                .setTitle("Formulário de Encomenda");

            const typeInput = new TextInputBuilder()
                .setCustomId("orderType")
                .setLabel("Tipo de Encomenda")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const descriptionInput = new TextInputBuilder()
                .setCustomId("orderDescription")
                .setLabel("Descrição da Encomenda")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const attachmentInput = new TextInputBuilder()
                .setCustomId("orderAttachments")
                .setLabel("Anexos (links ou códigos, opcional)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const deadlineInput = new TextInputBuilder()
                .setCustomId("orderDeadline")
                .setLabel("Prazo Estimado (ex: 3 dias, opcional)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const firstActionRow = new ActionRowBuilder().addComponents(typeInput);
            const secondActionRow = new ActionRowBuilder().addComponents(descriptionInput);
            const thirdActionRow = new ActionRowBuilder().addComponents(attachmentInput);
            const fourthActionRow = new ActionRowBuilder().addComponents(deadlineInput);

            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);
            return await interaction.showModal(modal);
        }

        else if (interaction.customId === "status_in_progress" ||
                 interaction.customId === "status_complete") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para utilizar este botão.", ephemeral: true });
            }
            
            const { channel } = interaction;
            if (!channel || !channel.name) return;

            if (interaction.customId === "status_in_progress") {
                const newName = channel.name.replace("📦-encomenda", "🟡-producao");
                await channel.setName(newName);
                return interaction.reply({ content: "Status atualizado para Em Andamento.", ephemeral: true });
            } else if (interaction.customId === "status_complete") {
                const modal = new ModalBuilder()
                    .setCustomId("finalize_order_modal")
                    .setTitle("Finalizar Encomenda");

                const valueInput = new TextInputBuilder()
                    .setCustomId("order_value")
                    .setLabel("Valor da Encomenda (R$)")
                    .setPlaceholder("Ex: 50.00 ou 150")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(valueInput);
                modal.addComponents(row);

                return await interaction.showModal(modal);
            }
        }

        else if (interaction.customId === "opcoes") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para utilizar este botão.", ephemeral: true });
            }
            
            const optionsEmbed = new EmbedBuilder()
                .setTitle("Opções de Produção")
                .setDescription("Escolha uma opção:")
                .setColor(0xF1C40F);
            
            const assumirButton = new ButtonBuilder()
                .setCustomId("assumir_producao")
                .setLabel("Assumir Produção")
                .setEmoji(customEmojis.worker)
                .setStyle(ButtonStyle.Primary);
            const desistirButton = new ButtonBuilder()
                .setCustomId("desistir_producao")
                .setLabel("Desistir da Produção")
                .setEmoji(customEmojis.error)
                .setStyle(ButtonStyle.Secondary);
            
            const notifyButton = new ButtonBuilder()
                .setCustomId("notify_client")
                .setLabel("Notificar Cliente")
                .setEmoji(customEmojis.bell)
                .setStyle(ButtonStyle.Success);
            const progressDecrease = new ButtonBuilder()
                .setCustomId("progress_decrease")
                .setEmoji(customEmojis.arrowLeft)
                .setStyle(ButtonStyle.Secondary);
            const progressIncrease = new ButtonBuilder()
                .setCustomId("progress_increase")
                .setEmoji(customEmojis.arrowRight)
                .setStyle(ButtonStyle.Secondary);
            
            const optionsRow = new ActionRowBuilder().addComponents(assumirButton, desistirButton, notifyButton);
            const progressRow = new ActionRowBuilder().addComponents(progressDecrease, progressIncrease);
            
            return interaction.reply({ 
                content: "Opções disponíveis:", 
                embeds: [optionsEmbed], 
                components: [optionsRow, progressRow], 
                ephemeral: true 
            });
        }

        else if (interaction.customId === "desistir_producao") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para utilizar esta opção.", ephemeral: true });
            }
            
            const channel = interaction.channel;
            if (!channel) return;

            const messages = await channel.messages.fetch({ limit: 10 });
            const orderMessage = messages.find(m => 
                m.author.id === client.user.id && 
                m.embeds.length > 0 &&
                m.embeds[0].title === "Nova Encomenda Recebida"
            );
            
            if (!orderMessage) {
                return interaction.reply({ content: "Mensagem original não encontrada.", ephemeral: true });
            }
            
            const embed = EmbedBuilder.from(orderMessage.embeds[0]);

            if (embed.data.fields) {
                embed.data.fields = embed.data.fields.filter(field => field.name !== "Responsável");
            }
            
            await orderMessage.edit({ embeds: [embed] });
            return interaction.reply({ content: "Você desistiu da produção. A responsabilidade foi removida.", ephemeral: true });
        }

        else if (interaction.customId === "assumir_producao") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para utilizar esta opção.", ephemeral: true });
            }
            
            const channel = interaction.channel;
            if (!channel) return;

            const messages = await channel.messages.fetch({ limit: 10 });
            const orderMessage = messages.find(m => 
                m.author.id === client.user.id && 
                m.embeds.length > 0 && 
                m.embeds[0].title === "Nova Encomenda Recebida"
            );
            
            if (!orderMessage) {
                return interaction.reply({ content: "Mensagem original não encontrada.", ephemeral: true });
            }

            const embed = EmbedBuilder.from(orderMessage.embeds[0]);
            
            if (embed.data.fields) {
                embed.data.fields = embed.data.fields.filter(field => field.name !== "Responsável");
            }
            
            embed.addFields({ name: "Responsável", value: interaction.member.user.tag, inline: true });

            await orderMessage.edit({ embeds: [embed] });
            return interaction.reply({ content: "Você assumiu a produção desta encomenda!", ephemeral: true });
        }

        else if (interaction.customId === "transferir_producao") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para utilizar esta opção.", ephemeral: true });
            }
            return interaction.reply({ content: "Opção de Transferir Produção ativada. (Funcionalidade não implementada)", ephemeral: true });
        }

        else if (interaction.customId === "notify_client") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para notificar o cliente.", ephemeral: true });
            }

            const channel = interaction.channel;
            if (!channel) return;
            const messages = await channel.messages.fetch({ limit: 10 });
            const orderMessage = messages.find(m => 
                m.author.id === client.user.id &&
                m.embeds.length > 0 &&
                m.embeds[0].title === "Nova Encomenda Recebida"
            );
            if (!orderMessage) {
                return interaction.reply({ content: "Mensagem original não encontrada.", ephemeral: true });
            }
            const embed = orderMessage.embeds[0];
            let userId = "";
            const userField = embed.fields.find(f => f.name === "Usuário");
            if (userField) {
                const match = userField.value.match(/\((\d+)\)$/);
                if (match) userId = match[1];
            }
            if (!userId) {
                return interaction.reply({ content: "Não foi possível identificar o usuário.", ephemeral: true });
            }
            try {
                const user = await client.users.fetch(userId);
                await user.send("Olá, seu pedido recebeu uma atualização. Por favor, verifique no canal de atendimento.");
                return interaction.reply({ content: "Cliente notificado com sucesso.", ephemeral: true });
            } catch (err) {
                console.error("Erro ao enviar DM para o usuário:", err);
                return interaction.reply({ content: "Falha ao notificar o cliente.", ephemeral: true });
            }
        }

        else if (interaction.customId === "progress_decrease") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para alterar o progresso.", ephemeral: true });
            }
            const channel = interaction.channel;
            if (!channel) return;
            const messages = await channel.messages.fetch({ limit: 10 });
            const orderMessage = messages.find(m =>
                m.author.id === client.user.id &&
                m.embeds.length > 0 &&
                m.embeds[0].title === "Nova Encomenda Recebida"
            );
            if (!orderMessage) {
                return interaction.reply({ content: "Mensagem original não encontrada.", ephemeral: true });
            }
            const embed = EmbedBuilder.from(orderMessage.embeds[0]);

            let progressFieldIndex = embed.data.fields.findIndex(f => f.name === "Progresso");
            let currentProgress = 0;
            if (progressFieldIndex !== -1) {
                currentProgress = parseInt(embed.data.fields[progressFieldIndex].value.match(/\d+/)?.[0]) || 0;
            }
            currentProgress = Math.max(0, currentProgress - 10);
            const progressBar = generateProgressBar(currentProgress);
            updateProgressField(embed, progressBar, currentProgress);
            await orderMessage.edit({ embeds: [embed] });
            return interaction.reply({ content: `Progresso atualizado para ${currentProgress}%.`, ephemeral: true });
        }

        else if (interaction.customId === "progress_increase") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para alterar o progresso.", ephemeral: true });
            }
            const channel = interaction.channel;
            if (!channel) return;
            const messages = await channel.messages.fetch({ limit: 10 });
            const orderMessage = messages.find(m =>
                m.author.id === client.user.id &&
                m.embeds.length > 0 &&
                m.embeds[0].title === "Nova Encomenda Recebida"
            );
            if (!orderMessage) {
                return interaction.reply({ content: "Mensagem original não encontrada.", ephemeral: true });
            }
            const embed = EmbedBuilder.from(orderMessage.embeds[0]);
            let progressFieldIndex = embed.data.fields.findIndex(f => f.name === "Progresso");
            let currentProgress = 0;
            if (progressFieldIndex !== -1) {
                currentProgress = parseInt(embed.data.fields[progressFieldIndex].value.match(/\d+/)?.[0]) || 0;
            }
            currentProgress = Math.min(100, currentProgress + 10);
            const progressBar = generateProgressBar(currentProgress);
            updateProgressField(embed, progressBar, currentProgress);
            await orderMessage.edit({ embeds: [embed] });
            return interaction.reply({ content: `Progresso atualizado para ${currentProgress}%.`, ephemeral: true });
        }

        else if (interaction.customId === "open_config_pix") {
            const modal = new ModalBuilder()
                .setCustomId("config_pix_modal")
                .setTitle("Configurar Chave PIX");

            const pixKeyInput = new TextInputBuilder()
                .setCustomId("pix_key")
                .setLabel("Digite a chave PIX")
                .setPlaceholder("exemplo@email.com, CPF, telefone ou chave aleatória")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(pixKeyInput);
            modal.addComponents(row);

            return await interaction.showModal(modal);
        }

        else if (interaction.customId === "open_config_support") {
            if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: `${customEmojis.error} Você não tem permissão para configurar o cargo de suporte.`, ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId("config_support_modal")
                .setTitle("Configurar Cargo de Suporte");

            const roleIdInput = new TextInputBuilder()
                .setCustomId("support_role_id")
                .setLabel("Digite o ID do cargo de suporte")
                .setPlaceholder("1234567890123456789")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(roleIdInput);
            modal.addComponents(row);

            return await interaction.showModal(modal);
        }

        else if (interaction.customId === "open_config_category") {
            if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: `${customEmojis.error} Você não tem permissão para configurar a categoria.`, ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId("config_category_modal")
                .setTitle("Configurar Categoria de Encomendas");

            const categoryIdInput = new TextInputBuilder()
                .setCustomId("category_id")
                .setLabel("Digite o ID da categoria")
                .setPlaceholder("1234567890123456789")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(categoryIdInput);
            modal.addComponents(row);

            return await interaction.showModal(modal);
        }

        else if (interaction.customId === "pagar_encomenda") {
            if (!config.pixKey) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Chave PIX não configurada! O administrador precisa usar o comando \`/configpix\` primeiro.`, 
                    ephemeral: true 
                });
            }

            const channel = interaction.channel;
            const orderValue = orderValues.get(channel.id) || "Não informado";

            // Embed com informações de pagamento (sem mostrar a chave PIX diretamente)
            const paymentEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.card} Informações de Pagamento`)
                .setDescription("Clique no botão abaixo para copiar a chave PIX e realizar o pagamento da sua encomenda.")
                .setColor(0x00B894)
                .addFields(
                    { name: "Valor da Encomenda", value: `R$ ${orderValue}`, inline: false },
                    { name: "Instruções", value: "1. Clique no botão **Copiar PIX** abaixo\n2. A chave será mostrada apenas para você\n3. Use a chave no app do seu banco\n4. Após o pagamento, aguarde a confirmação", inline: false }
                )
                .setFooter({ text: "A chave PIX é exibida apenas para você por segurança" });

            // Botão para copiar/mostrar a chave PIX
            const copyPixButton = new ButtonBuilder()
                .setCustomId("copiar_chave_pix")
                .setLabel("Copiar PIX")
                .setEmoji(customEmojis.copiar)
                .setStyle(ButtonStyle.Success);

            const cancelPaymentButton = new ButtonBuilder()
                .setCustomId("cancelar_pagamento")
                .setLabel("Cancelar")
                .setEmoji(customEmojis.x)
                .setStyle(ButtonStyle.Secondary);

            const payRow = new ActionRowBuilder().addComponents(copyPixButton, cancelPaymentButton);

            await interaction.reply({ embeds: [paymentEmbed], components: [payRow], ephemeral: false });

            try {
                await interaction.message.delete();
            } catch (error) {
                console.error("Erro ao deletar mensagem do botão Pagar Encomenda:", error);
            }

            const userId = interaction.user.id;

            // Enviar embed de confirmação de pagamento após 10 segundos
            setTimeout(async () => {
                try {
                    const paymentConfirmEmbed = new EmbedBuilder()
                        .setTitle(`${customEmojis.card} Aguardando Confirmação de Pagamento`)
                        .setDescription("O cliente solicitou o pagamento. Por favor, confirme quando o pagamento for verificado.")
                        .setColor(0xF39C12)
                        .addFields(
                            { name: "Cliente", value: `<@${userId}>`, inline: true },
                            { name: "Data/Hora", value: new Date().toLocaleString(), inline: true },
                            { name: "Status", value: `${customEmojis.hourglass} Aguardando confirmação do suporte`, inline: false }
                        )
                        .setFooter({ text: "Apenas o suporte pode confirmar o pagamento" });

                    const confirmPaymentButton = new ButtonBuilder()
                        .setCustomId("confirmar_pagamento")
                        .setLabel("Confirmar Pagamento")
                        .setEmoji(customEmojis.success)
                        .setStyle(ButtonStyle.Success);

                    const rejectPaymentButton = new ButtonBuilder()
                        .setCustomId("rejeitar_pagamento")
                        .setLabel("Rejeitar Pagamento")
                        .setEmoji(customEmojis.error)
                        .setStyle(ButtonStyle.Danger);

                    const confirmRow = new ActionRowBuilder().addComponents(confirmPaymentButton, rejectPaymentButton);

                    await channel.send({
                        content: `<@&${config.supportRoleId}>`,
                        embeds: [paymentConfirmEmbed],
                        components: [confirmRow]
                    });
                } catch (error) {
                    console.error("Erro ao enviar embed de confirmação:", error);
                }
            }, 10000);
        }

        // NOVO: Botão para copiar/mostrar a chave PIX (apenas para o usuário que clicou)
        else if (interaction.customId === "copiar_chave_pix") {
            if (!config.pixKey) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Chave PIX não configurada! Contate um administrador.`, 
                    ephemeral: true 
                });
            }

            // Mostra a chave PIX apenas para o usuário que clicou (ephemeral: true)
            const pixKeyEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.money} Sua Chave PIX para Pagamento`)
                .setDescription("Copie a chave PIX abaixo e use no app do seu banco:")
                .setColor(0x00B894)
                .addFields(
                    { 
                        name: "🔑 Chave PIX", 
                        value: `\`\`\`${config.pixKey}\`\`\``, 
                        inline: false 
                    },
                    { 
                        name: "📋 Como copiar?", 
                        value: "Toque e segure na chave acima para copiá-la automaticamente", 
                        inline: false 
                    }
                )
                .setFooter({ text: "⚠️ Esta chave é mostrada apenas para você" });

            return interaction.reply({ 
                embeds: [pixKeyEmbed], 
                ephemeral: true 
            });
        }

        // Botão para cancelar o pagamento
        else if (interaction.customId === "cancelar_pagamento") {
            const cancelEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.error} Pagamento Cancelado`)
                .setDescription("Você cancelou a visualização do pagamento. Se desejar pagar depois, solicite novamente ao suporte.")
                .setColor(0xE74C3C);

            // Atualiza a mensagem original removendo os botões
            await interaction.message.edit({ 
                embeds: [cancelEmbed], 
                components: [] 
            });

            return interaction.reply({ 
                content: "Pagamento cancelado com sucesso.", 
                ephemeral: true 
            });
        }

        else if (interaction.customId === "confirmar_pagamento") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: `${customEmojis.error} Você não tem permissão para confirmar pagamentos.`, ephemeral: true });
            }

            const channel = interaction.channel;
            if (!channel) return;

            await interaction.deferReply({ ephemeral: true });

            try {
                const channelData = channelPaymentStatus.get(channel.id);
                let userId = null;
                
                if (channelData && channelData.userId) {
                    userId = channelData.userId;
                }

                const messages = await channel.messages.fetch({ limit: 50 });
                const messagesToDelete = messages.filter(m => 
                    m.author.id === client.user.id && m.embeds.length > 0
                );

                for (const msg of messagesToDelete.values()) {
                    await msg.delete().catch(console.error);
                }

                const deliveryEmbed = new EmbedBuilder()
                    .setTitle(`${customEmojis.success} Compra Aprovada!`)
                    .setDescription(`**Parabéns!** Seu pagamento foi confirmado com sucesso.\n\n${customEmojis.party} Aguarde a entrega do produto neste canal ou no seu PV (mensagem privada).`)
                    .setColor(0x2ECC71)
                    .addFields(
                        { name: "Status", value: `${customEmojis.success} Pagamento Confirmado`, inline: true },
                        { name: "Próximo Passo", value: `${customEmojis.package} Aguardando Entrega`, inline: true },
                        { name: "Data de Aprovação", value: new Date().toLocaleString(), inline: false }
                    )
                    .setFooter({ text: "Você será notificado assim que o produto for entregue" });

                await channel.send({
                    content: userId ? `<@${userId}>` : "@here",
                    embeds: [deliveryEmbed]
                });

                if (userId) {
                    try {
                        const user = await client.users.fetch(userId);
                        
                        const htmlTranscript = await generateHTMLTranscript(channel);
                        
                        if (htmlTranscript) {
                            const buffer = Buffer.from(htmlTranscript, 'utf-8');
                            const attachment = {
                                attachment: buffer,
                                name: `transcricao-${channel.name}-${Date.now()}.html`
                            };
                            
                            await user.send({
                                content: `${customEmojis.success} **Compra Aprovada!** Seu pagamento foi confirmado. Aguarde a entrega do produto.\n\nAqui está a transcrição completa do atendimento em HTML:`,
                                files: [attachment]
                            });
                        } else {
                            await user.send(`${customEmojis.success} **Compra Aprovada!** Seu pagamento foi confirmado. Aguarde a entrega do produto neste canal ou no seu PV.`);
                        }
                    } catch (err) {
                        console.error("Erro ao enviar DM para o usuário:", err);
                    }
                }

                channelPaymentStatus.set(channel.id, { status: 'payment_confirmed', userId: userId });

                await interaction.editReply({ content: `${customEmojis.success} Pagamento confirmado com sucesso! Todas as mensagens anteriores foram removidas e transcrição enviada ao cliente.` });

            } catch (error) {
                console.error("Erro ao confirmar pagamento:", error);
                await interaction.editReply({ content: `${customEmojis.error} Ocorreu um erro ao processar a confirmação.` });
            }
        }

        else if (interaction.customId === "rejeitar_pagamento") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: `${customEmojis.error} Você não tem permissão para rejeitar pagamentos.`, ephemeral: true });
            }

            const channel = interaction.channel;
            if (!channel) return;

            const channelData = channelPaymentStatus.get(channel.id);
            const userId = channelData?.userId || null;

            const rejectEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.error} Pagamento Rejeitado`)
                .setDescription("O comprovante enviado foi rejeitado pela equipe de suporte. Por favor, verifique os dados e tente novamente.")
                .setColor(0xE74C3C)
                .addFields(
                    { name: "Motivo", value: "Comprovante inválido ou dados incorretos", inline: false },
                    { name: "Próximos Passos", value: "Realize o pagamento correto e envie um novo comprovante", inline: false }
                );

            const rejectMessage = await channel.send({ embeds: [rejectEmbed] });

            setTimeout(async () => {
                try {
                    await rejectMessage.delete();
                } catch (error) {
                    console.error("Erro ao deletar mensagem de rejeição:", error);
                }
            }, 10000);

            if (userId) {
                try {
                    const user = await client.users.fetch(userId);
                    await user.send(`${customEmojis.error} **Pagamento Rejeitado**\n\nSeu pagamento foi rejeitado pela equipe de suporte.\n\n**Motivo:** Comprovante inválido ou dados incorretos\n\n**Próximos Passos:** Realize o pagamento correto e envie um novo comprovante no canal de atendimento.`);
                } catch (err) {
                    console.error("Erro ao enviar DM para o usuário:", err);
                }
                channelPaymentStatus.set(channel.id, { status: 'awaiting_proof', userId: userId });
            }

            return interaction.reply({ content: "Pagamento rejeitado. O cliente foi notificado no canal e no PV.", ephemeral: true });
        }

        else if (interaction.customId === "confirm_close_channel") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para fechar canais.", ephemeral: true });
            }

            const channel = interaction.channel;
            if (!channel) return;

            await interaction.reply({ content: `${customEmojis.checkmark} Canal será fechado em 3 segundos...`, ephemeral: true });

            const messages = await channel.messages.fetch({ limit: 100 });
            const orderMessage = messages.find(m => 
                m.author.id === client.user.id &&
                m.embeds.length > 0 &&
                m.embeds[0].title === "Nova Encomenda Recebida"
            );
            
            let userId = null;
            if (orderMessage) {
                const userField = orderMessage.embeds[0].fields.find(f => f.name === "Usuário");
                if (userField) {
                    const match = userField.value.match(/\((\d+)\)$/);
                    if (match) userId = match[1];
                }
            }

            if (userId) {
                userActiveChannels.delete(userId);
            }

            await sendLogToChannel(config.closedOrdersLogChannel, {
                title: "🔒 Encomenda Fechada pelo Suporte",
                color: 0x95A5A6,
                fields: [
                    { name: "Canal", value: channel.name, inline: true },
                    { name: "Fechado por", value: interaction.user.tag, inline: true },
                    { name: "Data", value: new Date().toLocaleString(), inline: false }
                ]
            });

            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (error) {
                    console.error("Erro ao deletar canal:", error);
                }
            }, 3000);
        }

        else if (interaction.customId === "cancel_close_channel") {
            return interaction.reply({ content: "Fechamento cancelado.", ephemeral: true });
        }

        else if (interaction.customId === "cancel_order") {
            const channel = interaction.channel;
            if (!channel) return;

            const messages = await channel.messages.fetch({ limit: 100 });
            const orderMessage = messages.find(m => 
                m.author.id === client.user.id &&
                m.embeds.length > 0 &&
                m.embeds[0].title === "Nova Encomenda Recebida"
            );
            
            let orderOwnerId = null;
            if (orderMessage) {
                const userField = orderMessage.embeds[0].fields.find(f => f.name === "Usuário");
                if (userField) {
                    const match = userField.value.match(/\((\d+)\)$/);
                    if (match) orderOwnerId = match[1];
                }
            }

            const isSupport = interaction.member && interaction.member.roles.cache.has(config.supportRoleId);
            const isOwner = orderOwnerId === interaction.user.id;

            if (!isSupport && !isOwner) {
                return interaction.reply({ content: "Você não tem permissão para cancelar esta encomenda.", ephemeral: true });
            }

            const confirmEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.error} Confirmar Cancelamento`)
                .setDescription("Tem certeza que deseja cancelar esta encomenda? Esta ação não pode ser desfeita.")
                .setColor(0xE74C3C);

            const confirmButton = new ButtonBuilder()
                .setCustomId("confirm_cancel_order")
                .setLabel("Sim, Cancelar")
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId("abort_cancel_order")
                .setLabel("Não, Manter")
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            return interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
        }

        else if (interaction.customId === "confirm_cancel_order") {
            const channel = interaction.channel;
            if (!channel) return;

            const messages = await channel.messages.fetch({ limit: 100 });
            const orderMessage = messages.find(m => 
                m.author.id === client.user.id &&
                m.embeds.length > 0 &&
                m.embeds[0].title === "Nova Encomenda Recebida"
            );
            
            let orderOwnerId = null;
            if (orderMessage) {
                const userField = orderMessage.embeds[0].fields.find(f => f.name === "Usuário");
                if (userField) {
                    const match = userField.value.match(/\((\d+)\)$/);
                    if (match) orderOwnerId = match[1];
                }
            }

            const isSupport = interaction.member && interaction.member.roles.cache.has(config.supportRoleId);
            const canceledBy = isSupport ? "Suporte" : "Cliente";

            const cancelEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.error} Encomenda Cancelada pelo ${canceledBy}`)
                .setDescription(`Esta encomenda foi cancelada pelo ${canceledBy.toLowerCase()}.`)
                .setColor(0xE74C3C)
                .addFields(
                    { name: isSupport ? "Staff" : "Cliente", value: `<@${interaction.user.id}>`, inline: true },
                    { name: "Data do Cancelamento", value: new Date().toLocaleString(), inline: true }
                );

            await channel.send({ 
                content: orderOwnerId ? `<@${orderOwnerId}> <@&${config.supportRoleId}>` : `<@&${config.supportRoleId}>`,
                embeds: [cancelEmbed] 
            });

            await sendLogToChannel(config.closedOrdersLogChannel, {
                title: `📦 Encomenda Cancelada pelo ${canceledBy}`,
                color: 0xE74C3C,
                fields: [
                    { name: "Canal", value: channel.name, inline: true },
                    { name: "Cancelado por", value: `${interaction.user.tag}`, inline: true },
                    { name: "Data", value: new Date().toLocaleString(), inline: false }
                ]
            });

            await interaction.update({ content: "Encomenda cancelada. O canal será excluído em breve.", components: [], embeds: [] });

            if (orderOwnerId) {
                userActiveChannels.delete(orderOwnerId);
                
                try {
                    const user = await client.users.fetch(orderOwnerId);
                    await user.send(`${customEmojis.error} **Encomenda Cancelada**\n\nSua encomenda foi cancelada pelo ${canceledBy.toLowerCase()}.\n\n**Cancelado por:** ${interaction.user.tag}\n**Data:** ${new Date().toLocaleString()}\n\nO canal de atendimento será excluído em breve.`);
                } catch (err) {
                    console.error("Não foi possível enviar DM para o usuário sobre o cancelamento:", err);
                }
            }
            
            setTimeout(async () => {
                await channel.delete().catch(console.error);
            }, 5000);
        }

        else if (interaction.customId === "abort_cancel_order") {
            return interaction.update({ content: "Cancelamento abortado.", components: [], embeds: [] });
        }

        else if (interaction.customId === "config_open_logs" || interaction.customId === "config_closed_logs") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para configurar canais de logs.", ephemeral: true });
            }

            const isOpenLogs = interaction.customId === "config_open_logs";
            const modal = new ModalBuilder()
                .setCustomId(isOpenLogs ? "modal_open_logs" : "modal_closed_logs")
                .setTitle(isOpenLogs ? "Canal de Encomendas Abertas" : "Canal de Encomendas Fechadas");

            const channelIdInput = new TextInputBuilder()
                .setCustomId("log_channel_id")
                .setLabel("Digite o ID do canal")
                .setPlaceholder("1234567890123456789")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(channelIdInput);
            modal.addComponents(row);

            return await interaction.showModal(modal);
        }
    }

    else if (interaction.isStringSelectMenu()){
        if (interaction.customId === "status_select") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para atualizar o status.", ephemeral: true });
            }
            const selected = interaction.values[0]; 
            let statusMessage = "";
            if (selected === "trabalhando") statusMessage = "Estamos trabalhando no seu pedido!";
            else if (selected === "aguardando") statusMessage = "Aguardando aprovação antes da entrega final.";
            else if (selected === "finalizado") statusMessage = "Pedido finalizado, obrigado!";

            const channel = interaction.channel;
            if (!channel) return;
            const messages = await channel.messages.fetch({ limit: 10 });
            const orderMessage = messages.find(m => 
                m.author.id === client.user.id &&
                m.embeds.length > 0 &&
                m.embeds[0].title === "Nova Encomenda Recebida"
            );
            if (!orderMessage) {
                return interaction.reply({ content: "Mensagem original não encontrada.", ephemeral: true });
            }
            const embed = EmbedBuilder.from(orderMessage.embeds[0]);

            let statusFieldIndex = embed.data.fields.findIndex(f => f.name === "Status");
            if (statusFieldIndex !== -1) {
                embed.data.fields[statusFieldIndex].value = statusMessage;
            } else {
                embed.addFields({ name: "Status", value: statusMessage, inline: true });
            }
            await orderMessage.edit({ embeds: [embed] });

            const userField = embed.data.fields.find(f => f.name === "Usuário");
            let userId = "";
            if (userField) {
                const match = userField.value.match(/\((\d+)\)$/);
                if (match) userId = match[1];
            }
            try {
                const user = await client.users.fetch(userId);
                await user.send(`Seu pedido foi atualizado: ${statusMessage}`);
            } catch (err) {
                console.error("Não foi possível enviar DM para o usuário.", err);
            }
            return interaction.reply({ content: "Status atualizado com sucesso!", ephemeral: true });
        }
    }

    else if (interaction.isModalSubmit()){
        if(interaction.customId === "order_modal"){
            const userId = interaction.user.id;
            
            if (userActiveChannels.has(userId)) {
                const existingChannelId = userActiveChannels.get(userId);
                const existingChannel = interaction.guild.channels.cache.get(existingChannelId);
                
                if (existingChannel) {
                    return interaction.reply({ 
                        content: `${customEmojis.error} Você já possui uma encomenda em andamento: ${existingChannel}. Por favor, aguarde a finalização antes de criar uma nova.`, 
                        ephemeral: true 
                    });
                } else {
                    userActiveChannels.delete(userId);
                }
            }

            const orderType = interaction.fields.getTextInputValue("orderType");
            const orderDescription = interaction.fields.getTextInputValue("orderDescription");
            const orderAttachments = interaction.fields.getTextInputValue("orderAttachments") || "Não informado";
            const orderDeadline = interaction.fields.getTextInputValue("orderDeadline") || "Não informado";

            await interaction.reply({ content: "Encomenda recebida! Criando um canal privado para seu atendimento...", ephemeral: true });

            const guild = interaction.guild;
            if (!guild) return;
            
            const sanitizedUsername = sanitizeUsername(interaction.user.username);
            const channelName = `📦-encomenda-${sanitizedUsername}`;
            
            try {
                const channel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: config.orderCategoryId,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                        },
                        {
                            id: client.user.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ReadMessageHistory]
                        },
                        {
                            id: config.supportRoleId,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                        }
                    ]
                });
                
                const confirmEmbed = new EmbedBuilder()
                    .setTitle("Nova Encomenda Recebida")
                    .setColor(0x3498DB)
                    .addFields(
                        { name: "Usuário", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                        { name: "Tipo", value: orderType, inline: true },
                        { name: "Descrição", value: orderDescription },
                        { name: "Anexos", value: orderAttachments, inline: true },
                        { name: "Prazo Estimado", value: orderDeadline, inline: true },
                        { name: "Data da Solicitação", value: new Date().toLocaleString(), inline: false },
                        { name: "Progresso", value: generateProgressBar(0), inline: true }
                    );

                const inProgressButton = new ButtonBuilder()
                    .setCustomId("status_in_progress")
                    .setLabel("Em Andamento")
                    .setEmoji(customEmojis.fab)
                    .setStyle(ButtonStyle.Primary);
                const cancelButton = new ButtonBuilder()
                    .setCustomId("cancel_order")
                    .setLabel("Cancelar Encomenda")
                    .setEmoji(customEmojis.x)
                    .setStyle(ButtonStyle.Danger);
                const completeButton = new ButtonBuilder()
                    .setCustomId("status_complete")
                    .setLabel("Finalizar Encomenda")
                    .setEmoji(customEmojis.box)
                    .setStyle(ButtonStyle.Success);
                const statusRow = new ActionRowBuilder().addComponents(inProgressButton, cancelButton, completeButton);

                const opcoesButton = new ButtonBuilder()
                    .setCustomId("opcoes")
                    .setLabel("Opções")
                    .setEmoji(customEmojis.mais)
                    .setStyle(ButtonStyle.Secondary);

                const updateStatusButton = new ButtonBuilder()
                    .setCustomId("update_status")
                    .setLabel("Atualizar Status")
                    .setEmoji(customEmojis.pin)
                    .setDisabled(true)
                    .setStyle(ButtonStyle.Secondary);
                const optionsRow = new ActionRowBuilder().addComponents(opcoesButton, updateStatusButton);
                
                userActiveChannels.set(userId, channel.id);

                await channel.send({ 
                    content: `${customEmojis.bell} Nova encomenda criada! <@&${config.supportRoleId}> pode atender?`, 
                    embeds: [confirmEmbed],
                    components: [statusRow, optionsRow]
                });

                await sendLogToChannel(config.openOrdersLogChannel, {
                    title: "📦 Nova Encomenda Aberta",
                    color: 0x3498DB,
                    fields: [
                        { name: "Canal", value: channel.name, inline: true },
                        { name: "Cliente", value: `${interaction.user.tag}`, inline: true },
                        { name: "Tipo", value: orderType, inline: false },
                        { name: "Data", value: new Date().toLocaleString(), inline: false }
                    ]
                });
                
                try {
                    await interaction.user.send(`Sua encomenda foi criada com sucesso: ${channel.name}`);
                } catch (err) {
                    console.error("Não foi possível enviar DM para o usuário.", err);
                }
            } catch (error) {
                console.error("Erro ao criar o canal de encomenda:", error);
            }
        }

        else if(interaction.customId === "finalize_order_modal"){
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para finalizar encomendas.", ephemeral: true });
            }

            const orderValue = interaction.fields.getTextInputValue("order_value").trim();
            
            const channel = interaction.channel;
            if (!channel) return;

            const messages = await channel.messages.fetch({ limit: 10 });
            const orderMessage = messages.find(m => 
                m.author.id === client.user.id &&
                m.embeds.length > 0 &&
                m.embeds[0].title === "Nova Encomenda Recebida"
            );
            
            let userIdValue = null;
            if (orderMessage) {
                const userField = orderMessage.embeds[0].fields.find(f => f.name === "Usuário");
                if (userField) {
                    const match = userField.value.match(/\((\d+)\)$/);
                    if (match) userIdValue = match[1];
                }
                await orderMessage.delete().catch(console.error);
            }

            if (userIdValue) {
                channelPaymentStatus.set(channel.id, { status: 'order_complete', userId: userIdValue });
                orderValues.set(channel.id, orderValue);
            }

            const newName = channel.name.replace(/(📦-encomenda|🟡-producao)/, "✅-finalizado");
            await channel.setName(newName);

            const readyEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.success} Encomenda Pronta!`)
                .setDescription(`Sua encomenda foi finalizada e está pronta para entrega!`)
                .setColor(0x2ECC71)
                .addFields(
                    { name: "Status", value: "Concluída", inline: true },
                    { name: "Valor", value: `R$ ${orderValue}`, inline: true },
                    { name: "Data de Conclusão", value: new Date().toLocaleString(), inline: false }
                );

            const payButton = new ButtonBuilder()
                .setCustomId("pagar_encomenda")
                .setLabel("Pagar Encomenda")
                .setEmoji(customEmojis.money)
                .setStyle(ButtonStyle.Success);
            
            const payRow = new ActionRowBuilder().addComponents(payButton);

            await channel.send({ 
                content: userIdValue ? `<@${userIdValue}>` : "@here",
                embeds: [readyEmbed], 
                components: [payRow] 
            });

            if (userIdValue) {
                try {
                    const user = await client.users.fetch(userIdValue);
                    await user.send(`${customEmojis.success} **Encomenda Pronta!**\n\nSua encomenda foi finalizada e está pronta para entrega!\n\n**Status:** Concluída\n**Valor:** R$ ${orderValue}\n**Data de Conclusão:** ${new Date().toLocaleString()}\n\nPor favor, acesse o canal de atendimento para efetuar o pagamento e receber seu produto.`);
                } catch (err) {
                    console.error("Erro ao enviar DM para o usuário:", err);
                }
            }

            return interaction.reply({ content: `Encomenda finalizada com sucesso! Valor: R$ ${orderValue}`, ephemeral: true });
        }

        else if(interaction.customId === "config_pix_modal"){
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para configurar a chave PIX.", ephemeral: true });
            }

            const pixKey = interaction.fields.getTextInputValue("pix_key");
            config.pixKey = pixKey;
            saveConfig();

            const successEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.success} Chave PIX Configurada`)
                .setDescription("A chave PIX foi configurada com sucesso e salva permanentemente!")
                .setColor(0x2ECC71)
                .addFields(
                    { name: "Chave PIX", value: `\`\`\`${pixKey}\`\`\``, inline: false },
                    { name: "Status", value: "Ativa e pronta para uso", inline: true }
                );

            return interaction.reply({ embeds: [successEmbed], ephemeral: true });
        }

        else if(interaction.customId === "config_support_modal"){
            if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: `${customEmojis.error} Você não tem permissão para configurar o cargo de suporte.`, ephemeral: true });
            }

            const roleId = interaction.fields.getTextInputValue("support_role_id").trim();
            
            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Cargo não encontrado! Verifique se o ID está correto.`, 
                    ephemeral: true 
                });
            }

            config.supportRoleId = roleId;
            saveConfig();

            const successEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.success} Cargo de Suporte Configurado`)
                .setDescription("O cargo de suporte foi configurado com sucesso e salvo permanentemente!")
                .setColor(0x2ECC71)
                .addFields(
                    { name: "Cargo de Suporte", value: `<@&${roleId}>`, inline: false },
                    { name: "ID do Cargo", value: `\`${roleId}\``, inline: false },
                    { name: "Status", value: "Ativo e pronto para uso", inline: true }
                );

            return interaction.reply({ embeds: [successEmbed], ephemeral: true });
        }

        else if(interaction.customId === "config_category_modal"){
            if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: `${customEmojis.error} Você não tem permissão para configurar a categoria.`, ephemeral: true });
            }

            const categoryId = interaction.fields.getTextInputValue("category_id").trim();
            
            const category = interaction.guild.channels.cache.get(categoryId);
            if (!category || category.type !== ChannelType.GuildCategory) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Categoria não encontrada! Verifique se o ID está correto e se é uma categoria válida.`, 
                    ephemeral: true 
                });
            }

            config.orderCategoryId = categoryId;
            saveConfig();

            const successEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.success} Categoria de Encomendas Configurada`)
                .setDescription("A categoria de encomendas foi configurada com sucesso e salva permanentemente!")
                .setColor(0x2ECC71)
                .addFields(
                    { name: "Categoria", value: category.name, inline: false },
                    { name: "ID da Categoria", value: `\`${categoryId}\``, inline: false },
                    { name: "Status", value: "Ativa e pronta para uso", inline: true }
                );

            return interaction.reply({ embeds: [successEmbed], ephemeral: true });
        }

        else if(interaction.customId === "modal_open_logs" || interaction.customId === "modal_closed_logs"){
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para configurar canais de logs.", ephemeral: true });
            }

            const channelId = interaction.fields.getTextInputValue("log_channel_id").trim();
            const isOpenLogs = interaction.customId === "modal_open_logs";
            
            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel || channel.type !== ChannelType.GuildText) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Canal não encontrado! Verifique se o ID está correto e se é um canal de texto válido.`, 
                    ephemeral: true 
                });
            }

            if (isOpenLogs) {
                config.openOrdersLogChannel = channelId;
            } else {
                config.closedOrdersLogChannel = channelId;
            }
            saveConfig();

            const successEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.success} Canal de Logs Configurado`)
                .setDescription(`O canal de ${isOpenLogs ? 'encomendas abertas' : 'encomendas fechadas'} foi configurado com sucesso!`)
                .setColor(0x2ECC71)
                .addFields(
                    { name: "Canal", value: `<#${channelId}>`, inline: false },
                    { name: "Tipo", value: isOpenLogs ? "Encomendas Abertas" : "Encomendas Fechadas", inline: true },
                    { name: "Status", value: "Ativo e pronto para uso", inline: true }
                );

            return interaction.reply({ embeds: [successEmbed], ephemeral: true });
        }
    }
});

async function generateHTMLTranscript(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        let html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transcrição - ${channel.name}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #36393f;
            color: #dcddde;
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: #2f3136;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        h1 {
            color: #ffffff;
            border-bottom: 2px solid #7289da;
            padding-bottom: 10px;
        }
        .message {
            margin: 15px 0;
            padding: 10px;
            background-color: #40444b;
            border-radius: 5px;
            border-left: 3px solid #7289da;
        }
        .message-header {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        .author {
            font-weight: bold;
            color: #7289da;
            margin-right: 10px;
        }
        .timestamp {
            font-size: 0.75em;
            color: #72767d;
        }
        .content {
            color: #dcddde;
            word-wrap: break-word;
        }
        .embed-info {
            color: #99aab5;
            font-style: italic;
        }
        .footer {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #40444b;
            text-align: center;
            color: #72767d;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Transcrição do Canal: ${channel.name}</h1>
        <p><strong>Total de mensagens:</strong> ${sortedMessages.size}</p>
        <p><strong>Data de geração:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        <hr>
`;

        sortedMessages.forEach(msg => {
            const timestamp = msg.createdAt.toLocaleString('pt-BR');
            const author = msg.author.tag;
            const content = msg.content || (msg.embeds.length > 0 ? '[Embed/Conteúdo Rico]' : '[Anexo/Mídia]');
            
            html += `
        <div class="message">
            <div class="message-header">
                <span class="author">${author}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
`;
        });

        html += `
        <div class="footer">
            <p>Transcrição gerada automaticamente pelo sistema de encomendas</p>
            <p>© ${new Date().getFullYear()} - Todos os direitos reservados</p>
        </div>
    </div>
</body>
</html>
`;

        return html;
    } catch (error) {
        console.error("Erro ao gerar transcrição HTML:", error);
        return null;
    }
}

async function sendLogToChannel(channelId, orderData) {
    if (!channelId) return;
    
    try {
        const logChannel = client.channels.cache.get(channelId);
        if (!logChannel) return;

        const logEmbed = new EmbedBuilder()
            .setTitle(orderData.title)
            .setColor(orderData.color)
            .addFields(orderData.fields)
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
        console.error("Erro ao enviar log para canal:", error);
    }
}

function generateProgressBar(progress) {
    const totalBlocks = 10;
    const filledBlocks = Math.floor((progress / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    return `[${customEmojis.progressFilled.repeat(filledBlocks)}${customEmojis.progressEmpty.repeat(emptyBlocks)}] ${progress}%`;
}

function updateProgressField(embed, progressBar, progress) {
    let progressFieldIndex = embed.data.fields.findIndex(f => f.name === "Progresso");
    if (progressFieldIndex !== -1) {
        embed.data.fields[progressFieldIndex].value = progressBar;
    } else {
        embed.addFields({ name: "Progresso", value: progressBar, inline: true });
    }
}

process.on('uncaughtException', async (error) => {
    console.error('Erro não capturado (uncaughtException):', error);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('Rejeição não tratada (unhandledRejection):', reason);
});

client.login(TOKEN)
    .then(() => {
        console.log('Bot conectado com sucesso!');
    })
    .catch((error) => {
        console.error('Erro ao conectar o bot:', error);
        setTimeout(() => {
            console.log('Tentando reconectar o bot...');
            client.login(TOKEN);
        }, 5000);
    });

process.on('exit', (code) => {
    console.log(`Processo encerrado com código ${code}. Reiniciando...`);
    client.login(TOKEN);
});
