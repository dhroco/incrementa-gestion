import { createMongoAbility } from '@casl/ability'
import { createContext } from 'react'
import { createContextualCan } from '@casl/react'

export const ability = createMongoAbility([])

export const AbilityContext = createContext(ability)

export const Can = createContextualCan(AbilityContext.Consumer)
