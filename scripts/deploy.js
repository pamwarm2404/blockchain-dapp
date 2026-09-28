import hre from "hardhat";

async function main() {
  console.log("Đang chuẩn bị phóng Smart Contract lên Sepolia...");

  const signers = await hre.ethers.getSigners();

  console.log("Số lượng signer:", signers.length);

  if (signers.length === 0) {
    throw new Error(
      "Không tìm thấy signer. Hãy kiểm tra PRIVATE_KEY trong file .env"
    );
  }

  console.log("Địa chỉ ví deploy:", await signers[0].getAddress());

  const Crowdfunding =
    await hre.ethers.getContractFactory("Crowdfunding", signers[0]);

  const crowdfunding = await Crowdfunding.deploy();

  await crowdfunding.waitForDeployment();

  const contractAddress = await crowdfunding.getAddress();

  console.log(
    "🎉 THÀNH CÔNG! Địa chỉ Contract của bạn là:",
    contractAddress
  );
}

main().catch((error) => {
  console.error("Quá trình deploy thất bại:", error);
  process.exitCode = 1;
});