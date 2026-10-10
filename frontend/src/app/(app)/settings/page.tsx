"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { User, AlertTriangle } from "lucide-react";
import { useMe, useUpdateProfile } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
});

export default function SettingsPage() {
  const { data: user } = useMe();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
    }
  });

  useEffect(() => {
    if (user) reset({ name: user.name });
  }, [user, reset]);

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    updateProfile.mutate(data, {
      onSuccess: () => {
        reset(data);
        toast({ title: "Profile updated" });
      },
      onError: error => toast({ title: "Could not update profile", description: getApiErrorMessage(error), variant: "destructive" }),
    });
  };

  if (!user) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings and preferences.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium">Profile</h3>
          <p className="text-sm text-muted-foreground">Update your personal information.</p>
        </div>
        <div className="md:col-span-2 space-y-4">
          <Card>
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                <div className="space-y-2 max-w-md">
                  <Label htmlFor="name">Display Name</Label>
                  <Input id="name" {...register("name")} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message as string}</p>}
                </div>
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" value={user.email} disabled />
                  <p className="text-xs text-muted-foreground">Email address cannot be changed.</p>
                </div>
                <div className="space-y-2 max-w-md">
                  <Label>Member Since</Label>
                  <Input value={format(new Date(user.createdAt), "MMMM d, yyyy")} disabled />
                </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4 flex justify-end">
                <Button type="submit" disabled={!isDirty || updateProfile.isPending}>{updateProfile.isPending ? "Saving..." : "Save Changes"}</Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3 pt-8 border-t">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
          <p className="text-sm text-muted-foreground">Irreversible actions for your account.</p>
        </div>
        <div className="md:col-span-2">
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <Alert variant="destructive" className="mb-4 bg-destructive/10">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  Deleting your account will permanently remove all your documents, chat history, and personal data. This action cannot be undone.
                </AlertDescription>
              </Alert>
              <Button variant="destructive" disabled>Delete Account</Button>
              <p className="text-sm text-muted-foreground mt-2">Account deletion is not available yet.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
