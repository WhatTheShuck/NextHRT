"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api from "@/lib/axios";
import { User } from "@/generated/prisma_client";
import { AlertTriangle } from "lucide-react";
interface MainProfileCardProps {
  userId: string;
}

export default function MainProfileCard({ userId }: MainProfileCardProps) {
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      try {
        setLoading(true);
        const response = await api.get(`/api/users/${userId}`);
        setUserData(response.data);
      } catch (err: any) {
        console.error("Error fetching user data:", err);
        setError(err.response?.data?.message || "Failed to load user details");
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  if (!userData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>No user data available</AlertDescription>
      </Alert>
    );
  }
  return (
    <Card className="shadow-lg">
      <CardContent className="p-0">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-lg p-8 text-white">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
              <AvatarImage
                src={userData.image || ""}
                alt={userData.name || ""}
              />
              <AvatarFallback className="bg-white text-purple-600 text-2xl font-bold">
                {userData.name?.charAt(0).toUpperCase()}
                {userData.name?.split(" ")[1]?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h1 className="text-3xl font-bold">{userData.name}</h1>
              <p className="text-blue-100 text-lg">{userData.email}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
