"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { auth, signIn, signOut } from "@/auth";

// ─── Schemas ───

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address format"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

// ─── Actions ───

/**
 * 🔹 Server Action: Login user with credentials
 */
export async function loginUserAction(
  data: LoginInput,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message,
    };
  }

  const { email, password } = parsed.data;

  try {
    await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      redirect: false,
    });

    return { success: true };
  } catch (error: any) {
    // Check if error is thrown by Next.js redirect mechanism
    if (error?.digest?.startsWith?.("NEXT_REDIRECT")) {
      throw error;
    }

    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return {
            success: false,
            error: "Invalid email or password",
          };
        default:
          return {
            success: false,
            error: "Authorization failed. Please try again.",
          };
      }
    }

    return {
      success: false,
      error: "Invalid email or password",
    };
  }
}

/**
 * 🔹 Server Action: Register new user
 */
export async function registerUserAction(data: RegisterInput): Promise<
  AuthActionResult & {
    user?: { id: string; name: string | null; email: string | null };
  }
> {
  try {
    const parsed = registerSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0].message,
      };
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return {
        success: false,
        error: "User with this email already exists",
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return {
      success: true,
      message: "Account created successfully!",
      user,
    };
  } catch (error: any) {
    console.error("registerUserAction error:", error);
    return {
      success: false,
      error: "Internal server error during registration",
    };
  }
}

/**
 * 🔹 Server Action: Delete user account and all cascaded data
 */
export async function deleteAccountAction(): Promise<AuthActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.user.delete({
      where: { id: session.user.id },
    });

    return { success: true };
  } catch (error: any) {
    console.error("deleteAccountAction error:", error);
    return {
      success: false,
      error: error?.message || "Failed to delete account",
    };
  }
}
/**
 * 🔹 Server Action: Logout user
 */
export async function logoutUserAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
