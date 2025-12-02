import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth";
import { useEffect, useState } from "react";

export default function Header() {
  const currentUser = getCurrentUser();
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: branches } = useQuery({
    queryKey: ["/api/branches"],
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const currentBranch = branches?.branches?.find((branch: any) => 
    branch.id === currentUser?.branchId
  );

  return (
    <header className="bg-card border-b border-border p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            {currentUser?.role === "manager" ? "Manager Dashboard" : "Employee Dashboard"}
          </h2>
          <p className="text-muted-foreground">
            {currentUser?.role === "manager" 
              ? "Overview of today's operations" 
              : "Your work dashboard"
            }
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {currentUser?.role === "manager" && currentBranch && (
            <div className="px-4 py-2 bg-primary/10 rounded-md" data-testid="current-branch">
              <span className="text-sm font-medium text-primary">{currentBranch.name}</span>
            </div>
          )}
          
          <div className="text-right">
            <p className="font-medium" data-testid="text-current-date">
              {currentTime.toLocaleDateString([], { 
                weekday: 'long',
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
            <p className="text-sm text-muted-foreground" data-testid="text-current-time">
              {currentTime.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
