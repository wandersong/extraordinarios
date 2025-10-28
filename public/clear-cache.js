// Script para limpar completamente o cache e reiniciar
// Execute no console do navegador (F12)

console.log("🧹 Limpando todo o cache do chat...");

// Limpar todas as chaves relacionadas ao chat
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('chat_messages_')) {
    localStorage.removeItem(key);
    console.log("🗑️ Removido:", key);
  }
});

console.log("✅ Cache limpo! Recarregue a página para começar do zero.");

// Função para recarregar automaticamente
setTimeout(() => {
  window.location.reload();
}, 1000);