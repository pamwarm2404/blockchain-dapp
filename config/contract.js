// Chỗ này ngày mai có tiền đẩy contract lên mạng xong, chúng ta sẽ dán địa chỉ thật vào
export const CONTRACT_ADDRESS = "0xA774cb3bA75F73D3004b1de480866307eC29Af3C";

// Đây là "Bản thiết kế" (ABI) để Web biết Smart Contract có những hàm gì
export const CONTRACT_ABI = [
  "function campaignCount() view returns (uint256)",
  "function campaigns(uint256) view returns (address creator, string title, uint256 goalAmount, uint256 deadline, uint256 amountCollected, bool isWithdrawn)",
  "function createCampaign(string _title, uint256 _goalAmount, uint256 _durationInMinutes)",
  "function donate(uint256 _campaignId) payable",
  "function withdrawFunds(uint256 _campaignId)",
  "function claimRefund(uint256 _campaignId)",
  "event CampaignCreated(uint256 indexed campaignId, address creator, string title, uint256 goal, uint256 deadline)",
  "event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount)"
];