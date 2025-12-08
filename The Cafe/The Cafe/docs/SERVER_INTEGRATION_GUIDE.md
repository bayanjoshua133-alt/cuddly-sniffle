// Integration Guide for Real-Time Manager in server/index.ts
// Add this code to your existing server/index.ts

import RealTimeManager from "./services/realtime-manager.js";

// After creating httpServer and app, add:
// ============================================

// Initialize Real-Time Manager
const realtime = new RealTimeManager(httpServer);

// Export for use in routes
export { realtime };

// Make realtime available to request handlers
app.use((req, res, next) => {
  req.app.locals.realtime = realtime;
  next();
});

// ============================================

// In server/routes.ts - Update shift-trades endpoints:
// ============================================

// POST /api/shift-trades - Create new trade request
router.post('/shift-trades', async (req, res) => {
  try {
    const { shiftId, targetUserId, reason, urgency } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (!shiftId || !targetUserId || !reason.trim()) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create trade in database
    const [newTrade] = await db.insert(schema.shiftTrades).values({
      id: crypto.randomUUID(),
      shiftId,
      fromUserId: userId,
      toUserId: targetUserId,
      reason,
      urgency: urgency || 'normal',
      status: 'pending',
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Fetch full trade with relations
    const fullTrade = await db
      .select()
      .from(schema.shiftTrades)
      .where(eq(schema.shiftTrades.id, newTrade.id))
      .leftJoin(schema.shifts, eq(schema.shiftTrades.shiftId, schema.shifts.id))
      .leftJoin(schema.users, eq(schema.shiftTrades.fromUserId, schema.users.id))
      .leftJoin(schema.users, eq(schema.shiftTrades.toUserId, schema.users.id))
      .then(result => result[0] || newTrade);

    // ✅ BROADCAST REAL-TIME EVENT
    const realtime = req.app.locals.realtime;
    if (realtime) {
      realtime.broadcastTradeCreated({
        ...newTrade,
        shift: fullTrade.shifts,
        fromUser: fullTrade.users_from,
        toUser: fullTrade.users_to,
      });
    }

    res.json(newTrade);
  } catch (error) {
    console.error('Error creating shift trade:', error);
    res.status(500).json({ error: 'Failed to create shift trade' });
  }
});

// PATCH /api/shift-trades/:id - Update trade status (employee response)
router.patch('/shift-trades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Only toUserId can respond
    const trade = await db
      .select()
      .from(schema.shiftTrades)
      .where(eq(schema.shiftTrades.id, id))
      .then(result => result[0]);

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.toUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized to respond to this trade' });
    }

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Update trade
    const [updatedTrade] = await db
      .update(schema.shiftTrades)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.shiftTrades.id, id))
      .returning();

    // ✅ BROADCAST REAL-TIME EVENT
    const realtime = req.app.locals.realtime;
    if (realtime) {
      realtime.broadcastTradeStatusChanged(id, status, updatedTrade);
    }

    res.json(updatedTrade);
  } catch (error) {
    console.error('Error updating trade:', error);
    res.status(500).json({ error: 'Failed to update trade' });
  }
});

// PATCH /api/shift-trades/:id/approve - Manager approval
router.patch('/shift-trades/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Verify user is manager
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .then(result => result[0]);

    if (!user || !['manager', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only managers can approve trades' });
    }

    // Get trade
    const trade = await db
      .select()
      .from(schema.shiftTrades)
      .where(eq(schema.shiftTrades.id, id))
      .then(result => result[0]);

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.status !== 'accepted') {
      return res.status(400).json({ error: 'Trade must be accepted before approval' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Update trade
    const [updatedTrade] = await db
      .update(schema.shiftTrades)
      .set({
        status,
        approvedAt: status === 'approved' ? new Date() : null,
        approvedBy: status === 'approved' ? userId : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.shiftTrades.id, id))
      .returning();

    if (status === 'approved') {
      // Swap shifts if approved
      const shift = await db
        .select()
        .from(schema.shifts)
        .where(eq(schema.shifts.id, trade.shiftId))
        .then(result => result[0]);

      if (shift) {
        // Update shift to new user
        await db
          .update(schema.shifts)
          .set({ userId: trade.toUserId, updatedAt: new Date() })
          .where(eq(schema.shifts.id, trade.shiftId));

        // ✅ BROADCAST SHIFT UPDATE
        const realtime = req.app.locals.realtime;
        if (realtime) {
          realtime.broadcastShiftUpdated({
            ...shift,
            userId: trade.toUserId,
          });
        }
      }
    }

    // ✅ BROADCAST TRADE STATUS CHANGE
    const realtime = req.app.locals.realtime;
    if (realtime) {
      realtime.broadcastTradeStatusChanged(id, status, updatedTrade);
    }

    res.json(updatedTrade);
  } catch (error) {
    console.error('Error approving trade:', error);
    res.status(500).json({ error: 'Failed to approve trade' });
  }
});

// PUT /api/shift-trades/:id/take - Take available shift
router.put('/shift-trades/:id/take', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const trade = await db
      .select()
      .from(schema.shiftTrades)
      .where(eq(schema.shiftTrades.id, id))
      .then(result => result[0]);

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.status !== 'pending') {
      return res.status(400).json({ error: 'Trade is no longer available' });
    }

    // Update trade
    const [updatedTrade] = await db
      .update(schema.shiftTrades)
      .set({ toUserId: userId, status: 'accepted', updatedAt: new Date() })
      .where(eq(schema.shiftTrades.id, id))
      .returning();

    // ✅ BROADCAST REAL-TIME EVENT
    const realtime = req.app.locals.realtime;
    if (realtime) {
      realtime.broadcastTradeStatusChanged(id, 'accepted', updatedTrade);
    }

    res.json(updatedTrade);
  } catch (error) {
    console.error('Error taking shift:', error);
    res.status(500).json({ error: 'Failed to take shift' });
  }
});

// DELETE /api/shift-trades/:id - Delete trade request
router.delete('/shift-trades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const trade = await db
      .select()
      .from(schema.shiftTrades)
      .where(eq(schema.shiftTrades.id, id))
      .then(result => result[0]);

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Only creator can delete
    if (trade.fromUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this trade' });
    }

    if (!['pending', 'rejected'].includes(trade.status)) {
      return res.status(400).json({ error: 'Cannot delete an accepted or approved trade' });
    }

    // Delete trade
    await db.delete(schema.shiftTrades).where(eq(schema.shiftTrades.id, id));

    // ✅ BROADCAST DELETION EVENT (optional)
    const realtime = req.app.locals.realtime;
    if (realtime) {
      // You could emit a delete event or just rely on query invalidation
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting trade:', error);
    res.status(500).json({ error: 'Failed to delete trade' });
  }
});

// ============================================

// When shifts are created/updated elsewhere, also emit events:
// ============================================

// Example: In shift creation route
router.post('/shifts', async (req, res) => {
  try {
    // ... create shift logic
    const newShift = { /* shift data */ };

    // ✅ BROADCAST TO ALL CLIENTS
    const realtime = req.app.locals.realtime;
    if (realtime) {
      realtime.broadcastShiftCreated(newShift);
    }

    res.json(newShift);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

// Example: In shift update route
router.patch('/shifts/:id', async (req, res) => {
  try {
    // ... update shift logic
    const updatedShift = { /* shift data */ };

    // ✅ BROADCAST TO ALL CLIENTS
    const realtime = req.app.locals.realtime;
    if (realtime) {
      realtime.broadcastShiftUpdated(updatedShift);
    }

    res.json(updatedShift);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

// ============================================

// Environment variables needed (add to .env or Render settings)
// ============================================
/*
VITE_API_URL=http://localhost:5000
SOCKET_IO_URL=http://localhost:5000
*/

// For production (Render):
/*
VITE_API_URL=https://your-render-url.onrender.com
SOCKET_IO_URL=https://your-render-url.onrender.com
*/

export default router;
