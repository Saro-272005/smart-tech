// Intha file-ah run panna, unga pudhu password-ku hash kedaikum.
import bcrypt from "bcryptjs";

// II. Unga pudhu password
const newPassword = "adminapple"; 

(async () => {
  const saltRounds = 10;
  const hash = await bcrypt.hash(newPassword, saltRounds);
  
  console.log("=============================================================");
  console.log("New password hash ):");
  console.log(hash);
  console.log("=============================================================");
})();
