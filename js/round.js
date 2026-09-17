function settleAction(previous, result, choice, days = 30) {
  if (!previous || previous.status !== 'playing') throw new Error('旅途已结束。');
  if (!Number.isInteger(days) || days < 0 || days > 365) throw new Error('行动时间无效。');
  const state = JSON.parse(JSON.stringify(previous));
  const messages = [];
  const finish = (reason, type) => {
    state.status = 'ended'; state.ending = reason; state.endingType = type;
  };
  const existingDeath = checkTriggers(state).find(t => t.type === 'death');
  if (existingDeath) {
    finish(existingDeath.reason, 'death');
    return { state, messages, fate: 'death' };
  }
  let fate = 'safe';
  if (result.combat) {
    const battle = resolveCombat(state, { power: 30 + Math.random() * 70 });
    messages.push((battle.victory ? '胜出' : '失利') + '，生命损失 ' + battle.hpLoss + '。');
    if (!battle.victory) applyEffects(state, { 心情: -10 });
  }
  const defeated = state.player.hp <= 0;
  messages.push(...applyEffects(state, result.effects));
  if (defeated) state.player.hp = 0;
  if (state.player.hp > 0 && result.danger !== 'none') {
    fate = judgeFate(state, result.danger);
    if (fate === 'death') {
      state.player.hp = 0;
      messages.push('你未能从这次危机中生还，旅途在此终结。');
    } else if (fate === 'survive') {
      messages.push('艰难生还，生命损失 ' + applySurvivalCost(state) + '，需要休整。');
    } else if (fate === 'twist') {
      messages.push('危机出现转机，你暂时脱离险境。' + applyTwistGain(state).join('，'));
    } else {
      messages.push('你渡过了这次危机。');
    }
  }
  const fatal = checkTriggers(state).find(t => t.type === 'death');
  if (fatal) {
    state.turn += 1;
    finish(fate === 'death' ? '未能渡过这次危机，身死道消。' : fatal.reason, 'death');
  } else {
    advanceTurn(state, days);
    for (let i = 0; i < getWorld(state.worldId).stages.length; i++) {
      const trigger = checkTriggers(state)[0];
      if (!trigger) break;
      if (trigger.type === 'death') { finish(trigger.reason, 'death'); break; }
      if (trigger.type === 'peak') { finish('你已达到此界的成长巅峰，留下属于自己的故事。', 'peak'); break; }
      applyPromotion(state, trigger.index);
      messages.push('成长阶段提升至「' + trigger.stage.name + '」。');
    }
    if (state.status === 'playing' && state.turn >= CONFIG.MAX_TURNS) {
      finish('这一段人生已走到尾声。', 'complete');
    }
  }
  state.log.push({ turn: state.turn, choice, danger: result.danger, fate });
  return { state, messages, fate };
}
