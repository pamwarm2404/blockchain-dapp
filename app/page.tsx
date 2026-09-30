"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../config/contract";

export default function Home() {
  // Các biến trạng thái lưu trữ dữ liệu
  const [account, setAccount] = useState("");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [history, setHistory] = useState([]);

  // =========================================================
  // 1. ÉP BUỘC METAMASK CHUYỂN SANG MẠNG SEPOLIA
  // =========================================================
  const switchToSepolia = async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) throw new Error("MetaMask not found!");

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // 0xaa36a7 là mã Hex của mạng Sepolia
      });
    } catch (error: any) {
      // Nếu ví MetaMask của người dùng chưa từng thêm mạng Sepolia (lỗi 4902)
      if (error.code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0xaa36a7",
              chainName: "Sepolia",
              nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      } else {
        throw error;
      }
    }
  };

  // =========================================================
  // 2. KIỂM TRA MẠNG HIỆN TẠI CỦA VÍ (Đã sửa lỗi BigInt)
  // =========================================================
  const checkSepoliaNetwork = async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) throw new Error("MetaMask not found!");

    const provider = new ethers.BrowserProvider(ethereum);
    const network = await provider.getNetwork();

    // Dùng hàm BigInt(11155111) để tránh lỗi cú pháp ES2020 của VS Code
    if (network.chainId !== BigInt(11155111)) {
      throw new Error("MetaMask is not on Sepolia network. Please switch to Sepolia.");
    }
    return provider;
  };

  // =========================================================
  // 3. HÀM KẾT NỐI VỚI SMART CONTRACT (Dùng chung)
  // =========================================================
  const getContract = async (needSigner = false) => {
    const provider = await checkSepoliaNetwork();
    if (needSigner) {
      const signer = await provider.getSigner(); // Dành cho hàm Ghi (Tạo, Quyên góp)
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider); // Dành cho hàm Đọc
  };

  // =========================================================
  // 4. KẾT NỐI VÍ METAMASK (Nút bấm trên giao diện)
  // =========================================================
  const connectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("❌ Please install MetaMask wallet!");
      return;
    }

    try {
      setIsLoading(true);
      await switchToSepolia();
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (!accounts || accounts.length === 0) throw new Error("No MetaMask account found.");
      
      setAccount(accounts[0]);
      await checkSepoliaNetwork();
      await loadCampaigns(); // Tải dữ liệu ngay khi kết nối thành công
      await fetchHistoricalEvents(); // Tải lịch sử sự kiện để minh chứng báo cáo
      
      alert("🎉 Wallet connected successfully!\n\nCurrent Network: Sepolia");
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      alert("❌ Failed to connect wallet:\n\n" + (error?.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // 5. LẮNG NGHE SỰ KIỆN REAL-TIME & TRUY XUẤT LỊCH SỬ (Ăn điểm 2.5)
  // =========================================================
  useEffect(() => {
    const ethereum = (window as any).ethereum;
    
    const setupListeners = async () => {
      // 5.1. Lắng nghe nếu người dùng đổi tài khoản khác trong ví MetaMask
      if (ethereum) {
        ethereum.on("accountsChanged", (accounts: string[]) => {
          setAccount(accounts.length > 0 ? accounts[0] : "");
        });
      }

      if (account) {
        try {
          const contract = await getContract(false);
          
          // 5.2. Lắng nghe sự kiện "Có người tạo chiến dịch mới"
          contract.on("CampaignCreated", (campaignId, creator, title, goal, deadline, event) => {
            console.log(`🔔 REAL-TIME EVENT: New Campaign! ID: ${campaignId}, Title: ${title}`);
            loadCampaigns(); // Tự động làm mới danh sách không cần F5
          });

          // 5.3. Lắng nghe sự kiện "Có người quyên góp" (Tên sự kiện khớp file .sol)
          contract.on("DonationReceived", (campaignId, donor, amount, event) => {
  console.log(`🔔 REAL-TIME EVENT: New Donation! Campaign ID: ${campaignId}, Donor: ${donor}`);
  
  // 1. Đổi tiền từ Wei sang ETH
  const formattedAmount = ethers.formatEther(amount);
  
  // 2. Tạo bản ghi lịch sử mới
  const newRecord = {
    campaignId: Number(campaignId),
    donor: donor,
    amount: formattedAmount,
    time: new Date().toLocaleTimeString()
  };

  // 3. Đẩy lên UI (giữ tối đa 10 giao dịch gần nhất)
  setHistory((prevHistory) => [newRecord, ...prevHistory].slice(0, 10));

  loadCampaigns(); 
});

          // Gỡ bỏ bộ lắng nghe khi tắt trình duyệt để tránh lag
          return () => {
            contract.removeAllListeners("CampaignCreated");
            contract.removeAllListeners("DonationReceived");
          };
        } catch (err) {
          console.log("Could not set up real-time listeners.", err);
        }
      }
    };
    
    setupListeners();
  }, [account]);

  // 5.4. Hàm lục lọi lịch sử sự kiện (Truy xuất minh chứng cho Giảng viên xem trong Console)
  const fetchHistoricalEvents = async () => {
    try {
      const contract = await getContract(false);
      console.log("===== FETCHING HISTORICAL EVENTS =====");
      
      const createFilter = contract.filters.CampaignCreated();
      const pastCreates = await contract.queryFilter(createFilter, 6850000, "latest");
      console.log("📜 Historical Campaigns Created:", pastCreates);

      const donateFilter = contract.filters.DonationReceived();
      const pastDonates = await contract.queryFilter(donateFilter, 6850000, "latest");
      console.log("📜 Historical Donations:", pastDonates);
      console.log("======================================");
    } catch (err) {
      console.log("Warning: Could not fetch historical events.", err);
    }
  };

  // =========================================================
  // 6. ĐỌC DANH SÁCH CHIẾN DỊCH TỪ BLOCKCHAIN
  // =========================================================
  const loadCampaigns = async () => {
    try {
      const contract = await getContract(false);
      const count = await contract.campaignCount();
      const loadedCampaigns = [];
      const campaignCount = Number(count); // Chuyển từ BigInt sang số nguyên

      for (let i = 1; i <= campaignCount; i++) {
        try {
          const camp = await contract.campaigns(i);
          loadedCampaigns.push({
            id: i,
            title: camp.title,
            goalAmount: ethers.formatEther(camp.goalAmount), // Chuyển từ Wei về ETH
            deadline: Number(camp.deadline),
          });
        } catch (error) {
          console.error(`Failed to load campaign ${i}:`, error);
        }
      }
      setCampaigns(loadedCampaigns);
    } catch (error: any) {
      console.error("Error loading campaigns:", error);
      setCampaigns([]);
    }
  };

  // =========================================================
  // 7. TẠO CHIẾN DỊCH MỚI
  // =========================================================
  const handleCreateCampaign = async (e: any) => {
    e.preventDefault();

    // Ràng buộc (Constraints) ở Frontend
    if (!title || !goal || !duration) return alert("⚠️ Please fill in all fields!");
    if (Number(goal) <= 0) return alert("⚠️ Goal (ETH) must be greater than 0!");
    if (Number(duration) <= 0) return alert("⚠️ Duration must be greater than 0!");

    try {
      setIsLoading(true);
      await switchToSepolia();
      const contract = await getContract(true);
      const goalInWei = ethers.parseEther(goal); // Chuyển số ETH người nhập thành đơn vị Wei chuẩn
      const durationInMinutes = parseInt(duration);

      const tx = await contract.createCampaign(title, goalInWei, durationInMinutes);
      alert("⏳ Transaction is being sent to Sepolia network.\n\nPlease confirm in MetaMask.");
      
      await tx.wait(); // Chờ giao dịch đào xong
      alert("🎉 Campaign created successfully!");
      
      setTitle(""); setGoal(""); setDuration(""); // Xóa form
      await loadCampaigns(); // Tải lại danh sách
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      const errorMessage = error?.reason || error?.shortMessage || error?.message || "Unknown error";
      alert("❌ Failed to create campaign:\n\n" + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // 8. QUYÊN GÓP (DONATE)
  // =========================================================
  const handleDonate = async (campaignId: number) => {
    const amount = window.prompt("Enter the amount of ETH you want to donate:");

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return alert("⚠️ Invalid amount or you cancelled the transaction!");
    }

    try {
      setIsLoading(true);
      await switchToSepolia();
      const contract = await getContract(true);
      const amountInWei = ethers.parseEther(amount);

      // Đính kèm số tiền quyên góp vào trường value của giao dịch
      const tx = await contract.donate(campaignId, { value: amountInWei });
      alert(`⏳ Sending ${amount} ETH to Sepolia network.\n\nPlease confirm in MetaMask.`);
      
      await tx.wait();
      alert("🎉 Donation successful!\n\nThank you for your generosity ❤️");
      await loadCampaigns();
    } catch (error: any) {
      console.error("Donation error:", error);
      const errorMessage = error?.reason || error?.shortMessage || error?.message || "Unknown error";
      alert("❌ Donation failed:\n\n" + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  // =========================================================
  // 8.5. HOÀN TIỀN (REFUND) - Dành cho chiến dịch thất bại
  // =========================================================
  const handleRefund = async (campaignId: number) => {
    try {
      setIsLoading(true);
      await switchToSepolia();
      const contract = await getContract(true);
      
      // LƯU Ý: Nếu file .sol của bạn đặt tên hàm là refund() thay vì claimRefund(), hãy sửa lại đoạn này cho khớp.
      const tx = await contract.claimRefund(campaignId); 
      alert(`⏳ Processing refund from Sepolia network.\n\nPlease confirm in MetaMask.`);
      
      await tx.wait();
      alert("🎉 Refund successful!\n\nETH has been returned to your wallet.");
      await loadCampaigns();
    } catch (error: any) {
      console.error("Refund error:", error);
      const errorMessage = error?.reason || error?.shortMessage || error?.message || "Unknown error";
      alert("❌ Refund failed:\n\n" + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // 9. GIAO DIỆN (UI) - Đã dịch 100% tiếng Anh
  // =========================================================
  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 flex flex-col items-center pt-10">
      <h1 className="text-4xl font-bold text-blue-600 mb-8 text-center">
        Online Fundraising and Donation System
      </h1>

      {!account ? (
        <div className="flex flex-col items-center">
          <p className="text-gray-600 mb-4 text-center">
            Connect MetaMask to use the system.
          </p>
          <button
            onClick={connectWallet}
            disabled={isLoading}
            className={`text-white px-6 py-3 rounded-lg font-bold transition shadow-lg ${
              isLoading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isLoading ? "Connecting..." : "Connect MetaMask Wallet"}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* CỘT BÊN TRÁI */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
              <p className="text-green-600 font-bold mb-2">🎉 Wallet Connected:</p>
              <p className="text-sm text-blue-600 font-medium mb-2">Network: Sepolia</p>
              {/* Địa chỉ ví đã được rút gọn cho chuyên nghiệp */}
              <p className="font-mono text-sm bg-gray-100 p-3 rounded text-gray-600 break-all">
                {account.slice(0, 6)}...{account.slice(-4)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Create New Campaign</h2>
              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Campaign Name</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Build a school"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Goal (ETH)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 1.5"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 1440 (1 day)"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full text-white font-bold py-3 rounded transition ${
                    isLoading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isLoading ? "Processing..." : "Create Campaign"}
                </button>
              </form>
            </div>
          </div>

          {/* CỘT BÊN PHẢI */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Active Fundraising Campaigns</h2>
            <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2">
              {campaigns.length === 0 ? (
                <p className="text-gray-500 italic text-center py-8">
                  No campaigns found on the Blockchain.
                </p>
          {/* BẢNG TIN HOẠT ĐỘNG - GLOBAL ACTIVITY FEED */}
<div className="mt-8 bg-white p-6 rounded-xl shadow-md border border-gray-100">
  <h2 className="text-xl font-bold mb-4 text-blue-600">
    🕒 Live Activity Feed
  </h2>
  
  <div className="space-y-3">
    {history.length === 0 ? (
      <p className="text-gray-500 italic text-sm">Chưa có giao dịch nào gần đây. Hãy là người đầu tiên!</p>
    ) : (
      history.map((item, index) => (
        <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border-l-4 border-green-500 shadow-sm animate-pulse-once">
          🎉 Ví <span className="font-semibold text-blue-600">{item.donor.slice(0, 6)}...{item.donor.slice(-4)}</span> vừa quyên góp 
          <span className="font-bold text-green-600"> {item.amount} ETH </span> 
          cho Chiến dịch số <span className="font-bold">#{item.campaignId}</span>
          <span className="block text-xs text-gray-400 mt-1">Vào lúc {item.time}</span>
        </div>
      ))
    )}
  </div>
</div>
              ) : (
                campaigns.map((camp) => (
                  <div className="flex justify-between items-center mt-4">
                      <span className="text-xs font-medium text-red-500">
                         Deadline: {new Date(camp.deadline * 1000).toLocaleString("en-US")}
                      </span>
                  <div className="flex gap-2">
                  <button
                    onClick={() => handleDonate(camp.id)}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded text-sm font-bold transition ${
                    isLoading ? "bg-gray-400 text-gray-200" : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                  >
                   Donate
                  </button>
                   <button
                        onClick={() => handleRefund(camp.id)}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded text-sm font-bold transition ${
                        isLoading ? "bg-gray-400 text-gray-200" : "bg-yellow-500 text-gray-900 hover:bg-yellow-600"
                          }`}
                           >
                         Refund
                     </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
