// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * PredictionAgent.sol — SocialMint
 * Arc Testnet: Chain ID 5042002 | RPC: https://rpc.testnet.arc.network
 * Gas token: USDC (0x3600000000000000000000000000000000000000)
 * Faucet: https://faucet.circle.com → select Arc Testnet
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PredictionAgent {

    address public constant USDC = 0x3600000000000000000000000000000000000000;

    enum BetStatus { Active, Won, Lost, Cancelled }

    struct Bet {
        uint256   id;
        address   user;
        string    asset;
        string    condition;
        uint256   conditionValue;   // % × 100 (e.g. 2% = 200)
        string    outcome;
        uint256   timeframeSeconds;
        uint256   amountUsdc;       // 6-decimal USDC micro-units
        uint256   createdAt;
        uint256   expiresAt;
        BetStatus status;
        uint256   payoutUsdc;
        uint256   queueIndex;
        uint256   queueTotal;
        bytes32   conditionId;
    }

    address public owner;
    address public agent;

    uint256 public nextBetId       = 1;
    uint256 public houseFee        = 75;    // 7.5% (÷1000)
    uint256 public payoutMultiplier = 1850; // 1.85× (÷1000)

    mapping(uint256 => Bet)      public bets;
    mapping(address => uint256[]) public userBetIds;
    mapping(bytes32 => uint256[]) public conditionBetIds;

    uint256 public totalVolume;
    uint256 public houseBalance;

    IERC20 private usdc = IERC20(USDC);

    event BetPlaced(uint256 indexed betId, address indexed user, string asset, uint256 amountUsdc, bytes32 conditionId, uint256 queueIndex, uint256 queueTotal);
    event BetSettled(uint256 indexed betId, address indexed user, BetStatus result, uint256 payoutUsdc);
    event BetCancelled(uint256 indexed betId, address indexed user, uint256 refundUsdc);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier onlyAgent() { require(msg.sender == agent || msg.sender == owner, "Not agent"); _; }

    constructor(address _agent) {
        owner = msg.sender;
        agent = _agent;
    }

    function placeBet(
        address _user,
        string  memory _asset,
        string  memory _condition,
        uint256 _conditionValue,
        string  memory _outcome,
        uint256 _timeframeSeconds,
        uint256 _amountUsdc,
        uint256 _queueIndex,
        uint256 _queueTotal,
        bytes32 _conditionId
    ) external onlyAgent returns (uint256) {
        require(_amountUsdc > 0, "Amount required");
        require(_timeframeSeconds >= 60, "Min 60s");
        require(_queueIndex >= 1 && _queueIndex <= _queueTotal, "Bad queue index");

        // Pull USDC from agent wallet (agent must have approved this contract)
        require(usdc.transferFrom(msg.sender, address(this), _amountUsdc), "USDC transfer failed");

        uint256 betId = nextBetId++;
        bets[betId] = Bet({
            id: betId, user: _user, asset: _asset,
            condition: _condition, conditionValue: _conditionValue,
            outcome: _outcome, timeframeSeconds: _timeframeSeconds,
            amountUsdc: _amountUsdc,
            createdAt: block.timestamp, expiresAt: block.timestamp + _timeframeSeconds,
            status: BetStatus.Active, payoutUsdc: 0,
            queueIndex: _queueIndex, queueTotal: _queueTotal,
            conditionId: _conditionId
        });

        userBetIds[_user].push(betId);
        conditionBetIds[_conditionId].push(betId);
        totalVolume += _amountUsdc;

        emit BetPlaced(betId, _user, _asset, _amountUsdc, _conditionId, _queueIndex, _queueTotal);
        return betId;
    }

    function settleBet(uint256 _betId, bool _won) external onlyAgent {
        Bet storage bet = bets[_betId];
        require(bet.id != 0, "Not found");
        require(bet.status == BetStatus.Active, "Not active");
        require(block.timestamp >= bet.expiresAt, "Not expired");

        if (_won) {
            uint256 gross  = (bet.amountUsdc * payoutMultiplier) / 1000;
            uint256 fee    = ((gross - bet.amountUsdc) * houseFee) / 1000;
            uint256 payout = gross - fee;
            bet.status = BetStatus.Won;
            bet.payoutUsdc = payout;
            houseBalance += fee;
            require(usdc.transfer(bet.user, payout), "Payout failed");
            emit BetSettled(_betId, bet.user, BetStatus.Won, payout);
        } else {
            bet.status = BetStatus.Lost;
            houseBalance += bet.amountUsdc;
            emit BetSettled(_betId, bet.user, BetStatus.Lost, 0);
        }
    }

    function cancelBet(uint256 _betId) external onlyAgent {
        Bet storage bet = bets[_betId];
        require(bet.id != 0, "Not found");
        require(bet.status == BetStatus.Active, "Not active");
        bet.status = BetStatus.Cancelled;
        require(usdc.transfer(bet.user, bet.amountUsdc), "Refund failed");
        emit BetCancelled(_betId, bet.user, bet.amountUsdc);
    }

    function getBet(uint256 _betId)              external view returns (Bet memory)        { return bets[_betId]; }
    function getUserBets(address _user)           external view returns (uint256[] memory)  { return userBetIds[_user]; }
    function getConditionBets(bytes32 _conditionId) external view returns (uint256[] memory) { return conditionBetIds[_conditionId]; }
    function contractBalance()                    external view returns (uint256)           { return usdc.balanceOf(address(this)); }

    function setAgent(address _agent) external onlyOwner { agent = _agent; }

    function withdrawHouse(address _to, uint256 _amount) external onlyOwner {
        require(_amount <= houseBalance, "Exceeds house balance");
        houseBalance -= _amount;
        require(usdc.transfer(_to, _amount), "Withdraw failed");
    }
}
