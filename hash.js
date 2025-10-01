// generateHash.js
import bcrypt from "bcryptjs";

(async () => {
  const password = "Admin@123"; // admin password
  const hash = await bcrypt.hash(password, 10);
  console.log("Hash for Admin@123:", hash);
})();
