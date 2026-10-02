async function testLoginFlow() {
  console.log("=== TESTING LIVE LOGIN SUBMISSION ===");

  // 1. First fetch login page to get any CSRF or cookie context
  const getRes = await fetch("http://localhost:3000/login");
  console.log("GET /login Status:", getRes.status);

  // 2. Test login with Server Action or direct form post
  // In Next.js App Router, server actions can be invoked via POST with action ID or direct test
  // Let's test the action function directly in Node to verify execution without error
  const { loginAction } = await import("../src/server/actions/auth.actions");

  const formData = new FormData();
  formData.append("email", "saipassportmdu@gmail.com");
  formData.append("password", "Saitours@2026");
  formData.append("rememberMe", "on");

  try {
    const result = await loginAction(null, formData);
    console.log("loginAction result (if not redirected):", result);
  } catch (error: unknown) {
    const err = error as { message?: string; digest?: string };
    if (err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith("NEXT_REDIRECT")) {
      console.log("[PASS] loginAction correctly issued NEXT_REDIRECT (Authentication succeeded!)");
    } else {
      console.error("[FAIL] Unexpected error in loginAction:", error);
      process.exit(1);
    }
  }

  // 3. Test invalid password to verify rejection
  const badFormData = new FormData();
  badFormData.append("email", "saipassportmdu@gmail.com");
  badFormData.append("password", "WrongPassword!999");
  const badResult = await loginAction(null, badFormData);
  console.log("Bad password result:", badResult);
  if (badResult && !badResult.success && badResult.error) {
    console.log("[PASS] Invalid password properly rejected with error message:", badResult.error);
  } else {
    console.error("[FAIL] Bad password was not properly rejected:", badResult);
    process.exit(1);
  }

  console.log("=== ALL LOGIN FLOW TESTS COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

testLoginFlow();
