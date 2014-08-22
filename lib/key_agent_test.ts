import key_agent = require('./key_agent');
import testLib = require('./test');

testLib.addAsyncTest('auto-lock', (assert) => {
	var agent = new key_agent.SimpleKeyAgent();
	var lockEvents = 0;
	agent.onLock().listen(() => {
		lockEvents += 1
	});

	// setup auto-lock and unlock the agent
	agent.setAutoLockTimeout(20);
	agent.addKey('key1', 'testkey');
	assert.equal(agent.keyCount(), 1);
	setTimeout(() => {
		// check that a locked event was emitted
		// and that the agent has discarded any keys
		assert.equal(lockEvents, 1);
		assert.equal(agent.keyCount(), 0);

		// unlock the agent again and schedule a
		// batch of auto-lock resets.
		// The agent should only re-lock once after
		// the timeout expires
		agent.addKey('key2', 'anotherkey');
		for (var i=0; i < 10; i++) {
			agent.resetAutoLock();
		}
		setTimeout(() => {
			assert.equal(lockEvents, 2);
			assert.equal(agent.keyCount(), 0);

			testLib.continueTests();
		}, 40);
	}, 21);
});

testLib.start();