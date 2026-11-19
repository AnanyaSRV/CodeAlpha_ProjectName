
import jwt, { Secret, SignOptions } from "jsonwebtoken";

const ACCESS_SECRET: Secret = process.env.JWT_SECRET || "";

if (!ACCESS_SECRET) {
  throw new Error(
    "JWT_SECRET is missing. Please configure it in your .env file."
  );
}

export function generateToken(userId: string): string {
  return jwt.sign(
    { userId },
    ACCESS_SECRET,
    { expiresIn: "1d" } satisfies SignOptions
  );
}

export function verifyToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, ACCESS_SECRET);

  if (
    typeof decoded === "string" ||
    typeof decoded.userId !== "string"
  ) {
    throw new Error("Invalid authentication token");
  }

  return { userId: decoded.userId };
}
