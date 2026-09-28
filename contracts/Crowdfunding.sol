// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Crowdfunding {
    struct Campaign {
        address payable creator;
        string title;
        uint256 goalAmount;
        uint256 deadline;
        uint256 amountCollected;
        bool isWithdrawn;
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;

    event CampaignCreated(uint256 indexed campaignId, address creator, string title, uint256 goal, uint256 deadline);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event FundsWithdrawn(uint256 indexed campaignId, address creator, uint256 amount);
    event RefundClaimed(uint256 indexed campaignId, address indexed donor, uint256 amount);

    function createCampaign(string memory _title, uint256 _goalAmount, uint256 _durationInMinutes) external {
        require(_goalAmount > 0, "Goal must be > 0");
        campaignCount++;
        uint256 deadline = block.timestamp + (_durationInMinutes * 1 minutes);
        
        campaigns[campaignCount] = Campaign({
            creator: payable(msg.sender),
            title: _title,
            goalAmount: _goalAmount,
            deadline: deadline,
            amountCollected: 0,
            isWithdrawn: false
        });

        emit CampaignCreated(campaignCount, msg.sender, _title, _goalAmount, deadline);
    }

    function donate(uint256 _campaignId) external payable {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp < campaign.deadline, "Campaign ended");
        require(msg.value > 0, "Must be > 0");

        campaign.amountCollected += msg.value;
        donations[_campaignId][msg.sender] += msg.value;

        emit DonationReceived(_campaignId, msg.sender, msg.value);
    }

    function withdrawFunds(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.creator, "Only creator");
        require(block.timestamp >= campaign.deadline, "Not ended yet");
        require(campaign.amountCollected >= campaign.goalAmount, "Goal not reached");
        require(!campaign.isWithdrawn, "Already withdrawn");

        campaign.isWithdrawn = true;
        uint256 amount = campaign.amountCollected;
        campaign.creator.transfer(amount);
        
        emit FundsWithdrawn(_campaignId, msg.sender, amount);
    }

    function claimRefund(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp >= campaign.deadline, "Not ended yet");
        require(campaign.amountCollected < campaign.goalAmount, "Goal reached");
        
        uint256 donated = donations[_campaignId][msg.sender];
        require(donated > 0, "No funds");

        donations[_campaignId][msg.sender] = 0;
        payable(msg.sender).transfer(donated);
        
        emit RefundClaimed(_campaignId, msg.sender, donated);
    }
}