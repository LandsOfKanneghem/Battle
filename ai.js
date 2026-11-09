// Логика ИИ существ. Пока только пропуск; будущие атаки и движение добавляются здесь.
window.runAI = function(entity) {
  const gameState = window.gameState;
  const version = gameState.turnVersion;
  gameState.isSkippingTurn = true;
  window.updatePanel();
  setTimeout(() => {
    // Таймер завершённого хода не должен вмешиваться в новую очередь.
    if (version !== gameState.turnVersion || gameState.activeEntityId !== entity.id) return;
    window.beginTurn(gameState.nextLivingEntity(entity.id));
  }, 100);
};
