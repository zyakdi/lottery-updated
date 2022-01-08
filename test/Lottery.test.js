const assert = require('assert')
const ganache = require('ganache-cli')
const Web3 = require('web3')
const web3 = new Web3(ganache.provider())

const { abi, evm } = require('../compile');

let lottery;
let accounts;

beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    lottery = await new web3.eth.Contract(abi)
        .deploy({data: evm.bytecode.object})
        .send({from: accounts[0], gas: '1000000'})
})

describe('Lottery Contract', () => {
  it('deploys a contract', () => {
      assert.ok(lottery.options.address)
  })

  it('allows multiple accounts to enter', async () => {
      await lottery.methods.enter().send({
          from: accounts[0],
          value: web3.utils.toWei('0.02', 'ether')
      })
      await lottery.methods.enter().send({
          from: accounts[1],
          value: web3.utils.toWei('0.08', 'ether')
      })
      await lottery.methods.enter().send({
          from: accounts[2],
          value: web3.utils.toWei('0.1', 'ether')
      })

      const players = await lottery.methods.getPlayers().call({
          from: accounts[0]
      })

      assert.equal(accounts[0], players[0])
      assert.equal(accounts[1], players[1])
      assert.equal(accounts[2], players[2])
      assert.equal(3, players.length)
  })

  it('requires a minimum amount of ether to enter', async () => {
      let executed;
      try {
        await lottery.methods.enter().send({
          from: accounts[0],
          value: '100'
        });
        executed = 'success';
      } catch (err) {
        executed = 'fail'
      }
    
      assert.equal('fail', executed);
  });
    
  it('only manager can call pickWinner', async () => {
    let executed;
    try {
      // At least one person must enter the lottery else pickWinner will fail
      // even if invoked by the manager and this test will pass
      // because the error will be caught by the catch block.
      await lottery.methods.enter().send({
        from: accounts[1],
        value: web3.utils.toWei('0.02', 'ether')
      });
  
      await lottery.methods.pickWinner().send({
        from: accounts[1]
      });
  
      executed = 'success';
    } catch (err) {
      executed = 'fail';
    }
  
    assert.equal('fail', executed);
  });
  
  it('sends money to the winner and resets the players array', async () => {
    await lottery.methods.enter().send({
        from: accounts[0],
        value: web3.utils.toWei('2', 'ether')
    })

    const initialBalance = await web3.eth.getBalance(accounts[0])
    await lottery.methods.pickWinner().send({ from: accounts[0] })
    const finalBalance = await web3.eth.getBalance(accounts[0])
    const difference = finalBalance - initialBalance

    assert(difference > web3.utils.toWei('1.8', 'ether')) // Because of gas fees, it should be slightly less than 2
    const updatedPlayers = await lottery.methods.getPlayers().call({ from: accounts[0] })
    assert(updatedPlayers.length === 0)
    const lotteryBalance = await web3.eth.getBalance(lottery.options.address)
    assert(lotteryBalance === '0')
  });

  
})