export const acknowledgeDiscordCommand = async (interaction, acknowledgement) => {
    const visibility = acknowledgement === "defer-public" ? "public"
        : acknowledgement === "defer-ephemeral" ? "ephemeral"
            : acknowledgement === "defer-dynamic" ? interaction.options.getBoolean("public") === true ? "public" : "ephemeral" : null;
    if (visibility !== null && !interaction.responder.replied && !interaction.responder.deferred)
        await interaction.responder.deferReply(visibility);
};
export const toEditableResponse = (response) => {
    const { visibility: _visibility, ...editable } = response;
    return editable;
};
/** Completes an acknowledgement or follows up an already completed response. */
export const deliverDiscordResponse = async (responder, response) => {
    if (responder.replied)
        await responder.followUp(response);
    else if (responder.deferred)
        await responder.editReply(toEditableResponse(response));
    else
        await responder.reply(response);
};
export const interactionCreatedAt = (interaction) => {
    const date = new Date(interaction.createdAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== interaction.createdAt)
        throw new Error("Discord interaction creation time must be a canonical UTC timestamp.");
    return date;
};
//# sourceMappingURL=interaction-response.js.map