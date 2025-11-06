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
    StringSelectMenuBuilder
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
    orderCategoryId: "1417986273020219442",
    supportRoleId: "1435758114002567258",
    pixKey: null
};

const customEmojis = {
    error: "<:erro:0>",
    success: "<:sucesso:0>",
    money: "<:dinheiro:0>",
    card: "<:cartao:0>",
    hourglass: "<:ampulheta:0>",
    party: "<:festa:0>",
    package: "<:pacote:0>",
    settings: "<:config:0>",
    worker: "<:trabalhador:0>",
    bell: "<:sino:0>",
    progressFilled: "<:progresso_cheio:0>",
    progressEmpty: "<:progresso_vazio:0>",
    pin: "<:pin:0>",
    yellow: "<:amarelo:0>",
    checkmark: "<:check:0>",
    arrowLeft: "<:seta_esquerda:0>",
    arrowRight: "<:seta_direita:0>"
};

const channelPaymentStatus = new Map();

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

client.once('ready', () => {
    console.log(`Bot online como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if(message.author.bot) return;

    if(message.content.toLowerCase() === '!encomenda'){
        const orderEmbed = new EmbedBuilder()
            .setTitle("Sistema de Encomendas")
            .setDescription("Utilize este sistema para fazer sua encomenda. Clique em **Fazer Encomenda** para iniciar e preencha os dados necessários.")
            .setColor(0x00AE86);

        const orderButton = new ButtonBuilder()
            .setCustomId("order_button")
            .setLabel("Fazer Encomenda")
            .setStyle(ButtonStyle.Primary);
        
        const row = new ActionRowBuilder().addComponents(orderButton);
        
        await message.channel.send({ embeds: [orderEmbed], components: [row] });
    }

    if(message.content.toLowerCase() === "!listar"){
        const guild = message.guild;
        if(!guild) return;
        
        const channels = guild.channels.cache.filter(ch => 
            ch.name.startsWith("📦-encomenda") ||
            ch.name.startsWith("🟡-producao") ||
            ch.name.startsWith("✅-finalizado")
        );
        
        if(channels.size === 0){
            return message.channel.send("Nenhuma encomenda ativa encontrada.");
        }
        
        let listMsg = "Encomendas ativas:\n";
        channels.forEach(ch => {
            listMsg += `- ${ch.name}\n`;
        });
        
        return message.channel.send(listMsg);
    }

    if(message.content.toLowerCase() === '!configpix'){
        if (!message.member || !message.member.roles.cache.has(config.supportRoleId)) {
            return message.channel.send("Você não tem permissão para configurar a chave PIX.");
        }

        const currentPixKey = config.pixKey || "Nenhuma chave configurada";
        
        const pixEmbed = new EmbedBuilder()
            .setTitle(`${customEmojis.settings} Configuração de Chave PIX`)
            .setDescription("Configure a chave PIX que será exibida aos clientes no momento do pagamento.")
            .setColor(0x9B59B6)
            .addFields({ name: "Chave Atual", value: `\`${currentPixKey}\``, inline: false });

        return await message.reply({ 
            embeds: [pixEmbed],
            content: "Clique no botão abaixo para configurar ou alterar a chave PIX.", 
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("open_config_pix")
                        .setLabel(`${customEmojis.settings} Configurar PIX`)
                        .setStyle(ButtonStyle.Primary)
                )
            ]
        });
    }

    if(message.content.toLowerCase() === '!logs'){
        const channel = message.channel;
        if(!channel || !channel.name) return;

        if(!channel.name.includes('encomenda') && !channel.name.includes('producao') && !channel.name.includes('finalizado')){
            return message.channel.send("Este comando só pode ser usado em canais de encomenda.");
        }

        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const logs = messages.reverse().map(msg => {
                const timestamp = msg.createdAt.toLocaleString('pt-BR');
                const author = msg.author.tag;
                const content = msg.content || '[Embed/Anexo]';
                return `[${timestamp}] ${author}: ${content}`;
            }).join('\n');

            const logEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.pin} Logs do Canal`)
                .setDescription(`\`\`\`${logs.substring(0, 4000)}\`\`\``)
                .setColor(0x3498DB)
                .setFooter({ text: `Total de mensagens: ${messages.size}` });

            return message.channel.send({ embeds: [logEmbed] });
        } catch (error) {
            console.error("Erro ao buscar logs:", error);
            return message.channel.send("Erro ao buscar os logs do canal.");
        }
    }

    if(message.content.toLowerCase() === '!close'){
        if (!message.member || !message.member.roles.cache.has(config.supportRoleId)) {
            return message.channel.send("Você não tem permissão para fechar canais.");
        }

        const channel = message.channel;
        if(!channel || !channel.name) return;

        if(!channel.name.includes('encomenda') && !channel.name.includes('producao') && !channel.name.includes('finalizado')){
            return message.channel.send("Este comando só pode ser usado em canais de encomenda.");
        }

        const confirmEmbed = new EmbedBuilder()
            .setTitle(`${customEmojis.error} Confirmar Fechamento`)
            .setDescription("Tem certeza que deseja fechar este canal? Esta ação não pode ser desfeita.")
            .setColor(0xE74C3C);

        const confirmButton = new ButtonBuilder()
            .setCustomId("confirm_close_channel")
            .setLabel(`${customEmojis.checkmark} Confirmar`)
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId("cancel_close_channel")
            .setLabel(`${customEmojis.error} Cancelar`)
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        return message.channel.send({ embeds: [confirmEmbed], components: [row] });
    }

});

client.on('interactionCreate', async (interaction) => {
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
                 interaction.customId === "status_complete" ||
                 interaction.customId === "status_cancel") {
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
                const messages = await channel.messages.fetch({ limit: 10 });
                const orderMessage = messages.find(m => 
                    m.author.id === client.user.id &&
                    m.embeds.length > 0 &&
                    m.embeds[0].title === "Nova Encomenda Recebida"
                );
                
                let userName = "Cliente";
                let userIdValue = null;
                if (orderMessage) {
                    const userField = orderMessage.embeds[0].fields.find(f => f.name === "Usuário");
                    if (userField) {
                        userName = userField.value.split(' ')[0];
                        const match = userField.value.match(/\((\d+)\)$/);
                        if (match) userIdValue = match[1];
                    }
                    await orderMessage.delete().catch(console.error);
                }

                if (userIdValue) {
                    channelPaymentStatus.set(channel.id, { status: 'order_complete', userId: userIdValue });
                }

                const newName = channel.name.replace(/(📦-encomenda|🟡-producao)/, "✅-finalizado");
                await channel.setName(newName);

                const readyEmbed = new EmbedBuilder()
                    .setTitle(`${customEmojis.success} Encomenda Pronta!`)
                    .setDescription(`Sua encomenda foi finalizada e está pronta para entrega!`)
                    .setColor(0x2ECC71)
                    .addFields(
                        { name: "Status", value: "Concluída", inline: true },
                        { name: "Data de Conclusão", value: new Date().toLocaleString(), inline: true }
                    );

                const payButton = new ButtonBuilder()
                    .setCustomId("pagar_encomenda")
                    .setLabel(`${customEmojis.money} Pagar Encomenda`)
                    .setStyle(ButtonStyle.Success);
                
                const payRow = new ActionRowBuilder().addComponents(payButton);

                await channel.send({ 
                    content: userIdValue ? `<@${userIdValue}>` : "@here",
                    embeds: [readyEmbed], 
                    components: [payRow] 
                });

                return interaction.reply({ content: "Encomenda finalizada com sucesso!", ephemeral: true });
            } else if (interaction.customId === "status_cancel") {
                await interaction.reply({ content: "Encomenda cancelada. O canal será excluído.", ephemeral: true });
                return setTimeout(async () => {
                    await channel.delete().catch(console.error);
                }, 3000);
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
                .setLabel(`${customEmojis.worker} Assumir Produção`)
                .setStyle(ButtonStyle.Primary);
            const desistirButton = new ButtonBuilder()
                .setCustomId("desistir_producao")
                .setLabel(`${customEmojis.error} Desistir da Produção`)
                .setStyle(ButtonStyle.Secondary);
            
            const notifyButton = new ButtonBuilder()
                .setCustomId("notify_client")
                .setLabel(`${customEmojis.bell} Notificar Cliente`)
                .setStyle(ButtonStyle.Success);
            const progressDecrease = new ButtonBuilder()
                .setCustomId("progress_decrease")
                .setLabel(`${customEmojis.arrowLeft}`)
                .setStyle(ButtonStyle.Secondary);
            const progressIncrease = new ButtonBuilder()
                .setCustomId("progress_increase")
                .setLabel(`${customEmojis.arrowRight}`)
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

        else if (interaction.customId === "pagar_encomenda") {
            if (!config.pixKey) {
                return interaction.reply({ 
                    content: `${customEmojis.error} Chave PIX não configurada! O administrador precisa usar o comando \`!configpix\` primeiro.`, 
                    ephemeral: true 
                });
            }

            const paymentEmbed = new EmbedBuilder()
                .setTitle(`${customEmojis.money} Informações de Pagamento`)
                .setDescription("Utilize a chave PIX abaixo para realizar o pagamento da sua encomenda:")
                .setColor(0x00B894)
                .addFields(
                    { name: "Chave PIX", value: `\`\`\`${config.pixKey}\`\`\``, inline: false },
                    { name: "Instruções", value: "Após realizar o pagamento, a confirmação será solicitada automaticamente à equipe de suporte.", inline: false }
                )
                .setFooter({ text: "Copie a chave PIX acima e use no app do seu banco" });

            await interaction.reply({ embeds: [paymentEmbed], ephemeral: false });

            const channel = interaction.channel;
            const userId = interaction.user.id;

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
                        .setLabel(`${customEmojis.success} Confirmar Pagamento`)
                        .setStyle(ButtonStyle.Success);

                    const rejectPaymentButton = new ButtonBuilder()
                        .setCustomId("rejeitar_pagamento")
                        .setLabel(`${customEmojis.error} Rejeitar Pagamento`)
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
                        await user.send(`${customEmojis.success} **Compra Aprovada!** Seu pagamento foi confirmado. Aguarde a entrega do produto neste canal ou no seu PV.`);
                    } catch (err) {
                        console.error("Erro ao enviar DM para o usuário:", err);
                    }
                }

                channelPaymentStatus.set(channel.id, { status: 'payment_confirmed', userId: userId });

                await interaction.editReply({ content: `${customEmojis.success} Pagamento confirmado com sucesso! Todas as mensagens anteriores foram removidas.` });

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
                channelPaymentStatus.set(channel.id, { status: 'awaiting_proof', userId: userId });
            }

            return interaction.reply({ content: "Pagamento rejeitado. O cliente foi notificado.", ephemeral: true });
        }

        else if (interaction.customId === "confirm_close_channel") {
            if (!interaction.member || !interaction.member.roles.cache.has(config.supportRoleId)) {
                return interaction.reply({ content: "Você não tem permissão para fechar canais.", ephemeral: true });
            }

            const channel = interaction.channel;
            if (!channel) return;

            await interaction.reply({ content: `${customEmojis.checkmark} Canal será fechado em 3 segundos...`, ephemeral: true });

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
                    .setStyle(ButtonStyle.Primary);
                const cancelButton = new ButtonBuilder()
                    .setCustomId("status_cancel")
                    .setLabel("Cancelar Encomenda")
                    .setStyle(ButtonStyle.Danger);
                const completeButton = new ButtonBuilder()
                    .setCustomId("status_complete")
                    .setLabel("Finalizar Encomenda")
                    .setStyle(ButtonStyle.Success);
                const statusRow = new ActionRowBuilder().addComponents(inProgressButton, cancelButton, completeButton);

                const opcoesButton = new ButtonBuilder()
                    .setCustomId("opcoes")
                    .setLabel("Opções")
                    .setStyle(ButtonStyle.Secondary);

                const updateStatusButton = new ButtonBuilder()
                    .setCustomId("update_status")
                    .setLabel(`${customEmojis.pin} Atualizar Status`)
                    .setDisabled(true)
                    .setStyle(ButtonStyle.Secondary);
                const optionsRow = new ActionRowBuilder().addComponents(opcoesButton, updateStatusButton);
                
                await channel.send({ 
                    content: `${customEmojis.bell} Nova encomenda criada! <@&${config.supportRoleId}> pode atender?`, 
                    embeds: [confirmEmbed],
                    components: [statusRow, optionsRow]
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
    }
});

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
