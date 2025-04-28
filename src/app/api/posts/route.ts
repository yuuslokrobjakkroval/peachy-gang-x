import { prisma } from "@/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const userProfileId = searchParams.get("user");
  const page = searchParams.get("cursor") || "1";
  const LIMIT = 3;

  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const whereCondition =
    userProfileId && userProfileId !== "undefined"
      ? { parentPostId: null, userId: userProfileId }
      : {
          parentPostId: null,
          userId: {
            in: [
              userId,
              ...(
                await prisma.follow.findMany({
                  where: { followerId: userId },
                  select: { followingId: true },
                })
              ).map((follow) => follow.followingId),
            ],
          },
        };

  const postIncludeQuery = {
    user: { select: { displayName: true, username: true, img: true } },
    _count: { select: { likes: true, rePosts: true, comments: true } },
    likes: { where: { userId }, select: { id: true } },
    rePosts: { where: { userId }, select: { id: true } },
    saves: { where: { userId }, select: { id: true } },
  };

  try {
    const posts = await prisma.post.findMany({
      where: whereCondition,
      include: {
        rePost: {
          include: postIncludeQuery,
        },
        ...postIncludeQuery,
      },
      take: LIMIT,
      skip: (Number(page) - 1) * LIMIT,
      orderBy: { createdAt: "desc" },
    });

    const totalPosts = await prisma.post.count({ where: whereCondition });

    const hasMore = Number(page) * LIMIT < totalPosts;

    return NextResponse.json({ posts, hasMore });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
