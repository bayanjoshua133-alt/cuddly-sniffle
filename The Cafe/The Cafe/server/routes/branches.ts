import { Router, Request, Response } from "express";
import { z } from "zod";
import { dbStorage } from "../db-storage";

export function registerBranchesRoutes(router: Router) {
  // Get all branches with pagination and search
  router.get("/api/branches", async (req: Request, res: Response) => {
    try {
      const allBranches = await dbStorage.getAllBranches();
      res.json({ branches: allBranches });
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  // Get a single branch by ID
  router.get("/api/branches/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const branch = await dbStorage.getBranch(id);
      
      if (!branch) {
        return res.status(404).json({ message: "Branch not found" });
      }

      res.json(branch);
    } catch (error) {
      console.error("Error fetching branch:", error);
      res.status(500).json({ message: "Failed to fetch branch" });
    }
  });

  // Create a new branch
  router.post("/api/branches", async (req: Request, res: Response) => {
    try {
      console.log('Received request body:', req.body);
      
      const schema = z.object({
        name: z.string().min(1, "Name is required"),
        address: z.string().min(1, "Address is required"),
        phone: z.string().optional(),
        isActive: z.boolean().default(true),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        console.log('Validation error:', result.error);
        return res.status(400).json({
          message: "Validation error",
          errors: result.error.flatten().fieldErrors,
        });
      }

      const newBranch = await dbStorage.createBranch({
        name: result.data.name,
        address: result.data.address,
        phone: result.data.phone,
        isActive: result.data.isActive,
      });

      console.log('Branch created:', newBranch);
      res.status(201).json(newBranch);
    } catch (error) {
      console.error("Error creating branch:", error);
      res.status(500).json({ 
        message: "Failed to create branch",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update a branch
  router.put("/api/branches/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const schema = z.object({
        name: z.string().min(1, "Name is required"),
        address: z.string().min(1, "Address is required"),
        phone: z.string().optional(),
        isActive: z.boolean(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: result.error.flatten().fieldErrors,
        });
      }

      const updatedBranch = await dbStorage.updateBranch(id, {
        name: result.data.name,
        address: result.data.address,
        phone: result.data.phone,
        isActive: result.data.isActive,
      });

      if (!updatedBranch) {
        return res.status(404).json({ message: "Branch not found" });
      }

      res.json(updatedBranch);
    } catch (error) {
      console.error("Error updating branch:", error);
      res.status(500).json({ message: "Failed to update branch" });
    }
  });

  // Delete a branch (soft delete by setting isActive to false)
  router.delete("/api/branches/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const updatedBranch = await dbStorage.updateBranch(id, { isActive: false });

      if (!updatedBranch) {
        return res.status(404).json({ message: "Active branch not found" });
      }

      res.json({ message: "Branch deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating branch:", error);
      res.status(500).json({ message: "Failed to deactivate branch" });
    }
  });
}
