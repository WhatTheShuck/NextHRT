"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export const ProfileButton = async () => {
  // Call for now, but should prop drill from header on render
  const session = await auth();

  return (
    <Button variant="outline" size="icon">
      <img src={session?.user?.image} />
    </Button>
  );
};
