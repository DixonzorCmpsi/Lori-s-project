/**
 * Tests for Bulletin Board component.
 *
 * Covers:
 * - CAST-06: Cast views bulletin board
 * - DIR-08: Director posts to bulletin board
 * - DIR-09: Director pins a post
 * - Poster tab default, Schedule tab navigation
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// import { BulletinBoard } from '@/components/bulletin/BulletinBoard'

describe('BulletinBoard', () => {
  describe('Tabs', () => {
    it.todo('renders Posters and Schedule tabs')
    it.todo('shows Posters tab by default')
    it.todo('switches to Schedule tab on click')
  })

  describe('Posts display', () => {
    it.todo('renders posts with title, body, author, timestamp')
    it.todo('renders pinned post at the top')
    it.todo('orders posts newest-first')
    it.todo('renders Markdown content safely')
    it.todo('shows "(edited)" indicator for edited posts')
  })

  describe('Director/Staff actions', () => {
    it.todo('shows "New Post" button for Director')
    it.todo('shows "New Post" button for Staff')
    it.todo('does not show "New Post" button for Cast')
    it.todo('shows pin button on posts for Director')
    it.todo('shows delete button on own posts for Staff')
    it.todo('shows edit button on own posts for Director')
    it.todo('does not show edit/delete for Cast')
  })

  describe('Create post form', () => {
    it.todo('renders title and body fields')
    it.todo('validates title max 200 chars')
    it.todo('validates body max 10000 chars')
    it.todo('submits post on form submit')
  })
})
