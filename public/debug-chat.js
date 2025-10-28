// Debug localStorage para verificar dados do chat
// Adicione este script no console do browser para debugar

console.log("=== DEBUG CHAT STORAGE ===");

// Verificar todas as chaves do localStorage relacionadas ao chat
const chatKeys = Object.keys(localStorage).filter(key => key.startsWith('chat_messages_'));
console.log("Chaves encontradas:", chatKeys);

chatKeys.forEach(key => {
    const data = localStorage.getItem(key);
    try {
        const parsed = JSON.parse(data || '[]');
        console.log(`\n${key}:`, parsed);
        console.log(`Total de mensagens: ${parsed.length}`);
    } catch (error) {
        console.error(`Erro ao parsear ${key}:`, error);
    }
});

// Função para limpar cache específico
window.clearUserChat = function(userId) {
    const key = `chat_messages_${userId}`;
    localStorage.removeItem(key);
    console.log(`Cache limpo para usuário: ${userId}`);
    window.location.reload();
};

// Função para limpar todo o cache
window.clearAllChat = function() {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('chat_messages_'));
    keys.forEach(key => localStorage.removeItem(key));
    console.log("Todo o cache de chat foi limpo");
    window.location.reload();
};

console.log("\nFunções disponíveis:");
console.log("- clearUserChat(userId) - limpa cache de usuário específico");
console.log("- clearAllChat() - limpa todo cache de chat");